'use strict';

const ApiGatewayCachingSettings = require('./ApiGatewayCachingSettings');
const pathParametersCache = require('./pathParametersCache');
const updateStageCacheSettings = require('./stageCache');
const { restApiExists, outputRestApiIdTo } = require('./restApiId');

class ApiGatewayCachingPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:package:initialize': this.createSettings.bind(this),
      'before:package:finalize': this.updateCloudFormationTemplate.bind(this),
      'after:aws:deploy:finalize:cleanup': this.updateStage.bind(this),
    };

    this.defineValidationSchema(serverless);
  }

  createSettings() {
    this.settings = new ApiGatewayCachingSettings(this.serverless, this.options);
  }

  updateCloudFormationTemplate() {
    this.thereIsARestApi = restApiExists(this.serverless, this.settings);
    if (!this.thereIsARestApi) {
      this.serverless.cli.log(`[serverless-api-gateway-caching] No REST API found. Caching settings will not be updated.`);
      return;
    }

    outputRestApiIdTo(this.serverless);

    // if caching is not defined or disabled
    if (!this.settings.cachingEnabled) {
      return;
    }

    return pathParametersCache.addPathParametersCacheConfig(this.settings, this.serverless);
  }

  updateStage() {
    this.thereIsARestApi = restApiExists(this.serverless, this.settings);
    if (!this.thereIsARestApi) {
      this.serverless.cli.log(`[serverless-api-gateway-caching] No REST API found. Caching settings will not be updated.`);
      return;
    }

    if (!this.settings) {
      this.createSettings()
    }

    return updateStageCacheSettings(this.settings, this.serverless);
  }

  defineValidationSchema() {
    if (!this.serverless.configSchemaHandler
      || !this.serverless.configSchemaHandler.defineCustomProperties
      || !this.serverless.configSchemaHandler.defineFunctionEventProperties) {
      return;
    }

    const customSchema = this.customCachingSchema();
    this.serverless.configSchemaHandler.defineCustomProperties(customSchema);

    const httpSchema = this.httpEventCachingSchema();
    this.serverless.configSchemaHandler.defineFunctionEventProperties('aws', 'http', httpSchema);
  }

  httpEventCachingSchema() {
    return {
      type: 'object',
      properties: {
        caching: {
          properties: {
            enabled: { type: 'boolean' },
            ttlInSeconds: { type: 'number' },
            dataEncrypted: { type: 'boolean' },
            perKeyInvalidation: {
              properties: {
                requireAuthorization: { type: 'boolean' },
                handleUnauthorizedRequests: {
                  type: 'string',
                  enum: ['Ignore', 'IgnoreWithWarning', 'Fail']
                }
              }
            },
            cacheKeyParameters: {
              type: 'array',
              items: {
                properties: {
                  name: { type: 'string' },
                  value: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }

  customCachingSchema() {
    return {
      type: 'object',
      properties: {
        apiGatewayCaching: {
          properties: {
            enabled: { type: 'boolean' },
            apiGatewayIsShared: { type: 'boolean' },
            basePath: { type: 'string' },
            restApiId: { type: 'string' },
            clusterSize: { type: 'string' },
            ttlInSeconds: { type: 'number' },
            dataEncrypted: { type: 'boolean' },
            perKeyInvalidation: {
              properties: {
                requireAuthorization: { type: 'boolean' },
                handleUnauthorizedRequests: {
                  type: 'string',
                  enum: ['Ignore', 'IgnoreWithWarning', 'Fail']
                }
              }
            },
            additionalEndpoints: {
              type: 'array',
              items: {
                properties: {
                  method: { type: 'string' },
                  path: { type: 'string' },
                  caching: {
                    properties: {
                      enabled: { type: 'boolean' },
                      ttlInSeconds: { type: 'number' },
                      dataEncrypted: { type: 'boolean' },
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

module.exports = ApiGatewayCachingPlugin;
