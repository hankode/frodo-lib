import axios, { AxiosProxyConfig } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import Agent from 'agentkeepalive';
import axiosRetry from 'axios-retry';
import HttpsProxyAgent from 'https-proxy-agent';
import url from 'url';
import fs from 'fs';
import storage from '../storage/SessionStorage';
import path from 'path';
import { fileURLToPath } from 'url';
import { curlirizeMessage, printMessage } from '../ops/utils/Console';
import _curlirize from '../ext/axios-curlirize/curlirize';
import { randomUUID } from 'crypto';
import { mockAll } from '../test/mocks/ForgeRockApiMockEngine';

// this has to be the first statement after the imports for mocking to work
export const FrodoMockAdapter =
  process.env.FRODO_MOCK || process.env.frodo_mock
    ? new MockAdapter(axios)
    : undefined;

if (FrodoMockAdapter) mockAll(FrodoMockAdapter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
);

axiosRetry(axios, {
  retries: 3,
  shouldResetTimeout: true,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  retryCondition: (_error) => true, // retry no matter what
});

// all agents
const timeout = 30000;

// agentkeepalive
const maxSockets = 100;
const maxFreeSockets = 10;
const freeSocketTimeout = 30000;

const userAgent = `${pkg.name}/${pkg.version}`;
const transactionId = `frodo-${randomUUID()}`;
let httpAgent, httpsAgent;

function getHttpAgent() {
  if (httpAgent) return httpAgent;
  httpAgent = new Agent({
    maxSockets,
    maxFreeSockets,
    timeout,
    freeSocketTimeout,
  });
  return httpAgent;
}

/**
 * Helper method to create properly configured httpsAgent
 * @returns {any} appropriate httpsAgent
 */
function getHttpsAgent() {
  if (httpsAgent) return httpsAgent;
  const options = {
    rejectUnauthorized: !storage.session.getAllowInsecureConnection(),
  };
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (httpsProxy) {
    // https://github.com/axios/axios/issues/3459
    console.error(`Using proxy ${httpsProxy}`['yellow']);
    const parsed = url.parse(httpsProxy);
    options['host'] = parsed.hostname;
    options['port'] = parsed.port;
    options['protocol'] = parsed.protocol;
    options.rejectUnauthorized = !storage.session.getAllowInsecureConnection();
    httpsAgent = HttpsProxyAgent(options);
    return httpsAgent;
  }
  httpsAgent = new Agent.HttpsAgent({
    ...options,
    maxSockets,
    maxFreeSockets,
    timeout,
    freeSocketTimeout,
  });
  return httpsAgent;
}

/**
 * Get Proxy config
 * @returns {AxiosProxyConfig | false} axios proxy config or false
 */
function getProxy(): AxiosProxyConfig | false {
  if (process.env.HTTPS_PROXY || process.env.https_proxy) return false;
  return null;
}

/**
 * Customize curlirize output
 * @param request axios request object
 */
function curlirize(request) {
  _curlirize(request, (result, err) => {
    const { command } = result;
    if (err) {
      printMessage(err, 'error');
    } else {
      curlirizeMessage(command);
    }
  });
}

/**
 * Generates an AM Axios API instance
 * @param {object} resource Takes an object takes a resource object. example:
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateAmApi(resource, requestOverride = {}) {
  let headers = {
    'User-Agent': userAgent,
    'X-ForgeRock-TransactionId': transactionId,
    'Content-Type': 'application/json',
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
    // only send session cookie if we know its name and value
    ...(storage.session.getCookieName() &&
      storage.session.getCookieValue() && {
        Cookie: `${storage.session.getCookieName()}=${storage.session.getCookieValue()}`,
      }),
  };
  if (requestOverride['headers']) {
    headers = {
      ...headers,
      ...requestOverride['headers'],
    };
  }

  const requestDetails = {
    // baseURL: `${storage.session.getTenant()}/json`,
    timeout,
    ...requestOverride,
    headers: {
      ...headers,
      ...storage.session.getAuthenticationHeaderOverrides(),
    },
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (storage.session.getCurlirize()) {
    curlirize(request);
  }

  return request;
}

/**
 * Generates an OAuth2 Axios API instance
 * @param {object} resource Takes an object takes a resource object. example:
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either
 * add on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateOauth2Api(resource, requestOverride = {}) {
  let headers = {
    'User-Agent': userAgent,
    'X-ForgeRock-TransactionId': transactionId,
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
    // only send session cookie if we know its name and value
    ...(storage.session.getCookieName() &&
      storage.session.getCookieValue() && {
        Cookie: `${storage.session.getCookieName()}=${storage.session.getCookieValue()}`,
      }),
  };
  if (requestOverride['headers']) {
    headers = {
      ...headers,
      ...requestOverride['headers'],
    };
  }

  const requestDetails = {
    // baseURL: `${storage.session.getTenant()}/json${resource.path}`,
    timeout,
    ...requestOverride,
    headers: {
      ...headers,
      ...storage.session.getAuthenticationHeaderOverrides(),
    },
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (storage.session.getCurlirize()) {
    curlirize(request);
  }

  return request;
}

/**
 * Generates an IDM Axios API instance
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateIdmApi(requestOverride = {}) {
  const requestDetails = {
    // baseURL: getTenantURL(storage.session.getTenant()),
    timeout,
    headers: {
      'User-Agent': userAgent,
      'X-ForgeRock-TransactionId': transactionId,
      'Content-Type': 'application/json',
    },
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  if (storage.session.getBearerToken()) {
    requestDetails.headers[
      'Authorization'
    ] = `Bearer ${storage.session.getBearerToken()}`;
  }

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (storage.session.getCurlirize()) {
    curlirize(request);
  }

  return request;
}

/**
 * Generates a LogKeys API Axios instance
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateLogKeysApi(requestOverride = {}) {
  const headers = {
    'User-Agent': userAgent,
    'Content-Type': 'application/json',
  };
  const requestDetails = {
    // baseURL: getTenantURL(storage.session.getTenant()),
    timeout,
    headers,
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  if (storage.session.getBearerToken()) {
    requestDetails.headers[
      'Authorization'
    ] = `Bearer ${storage.session.getBearerToken()}`;
  }

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (storage.session.getCurlirize()) {
    curlirize(request);
  }

  return request;
}

/**
 * Generates a Log API Axios instance
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateLogApi(requestOverride = {}) {
  const headers = {
    'User-Agent': userAgent,
    'X-API-Key': storage.session.getLogApiKey(),
    'X-API-Secret': storage.session.getLogApiSecret(),
  };
  const requestDetails = {
    // baseURL: getTenantURL(storage.session.getTenant()),
    timeout,
    headers,
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (storage.session.getCurlirize()) {
    curlirize(request);
  }

  return request;
}

/**
 * Generates an ESV Axios API instance for Environment Secrets and Variables
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateESVApi(resource, requestOverride = {}) {
  const headers = {
    'User-Agent': userAgent,
    'Content-Type': 'application/json',
    // only add API version if we have it
    ...(resource.apiVersion && { 'Accept-API-Version': resource.apiVersion }),
  };
  const requestDetails = {
    // baseURL: getTenantURL(storage.session.getTenant()),
    timeout,
    headers,
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  if (storage.session.getBearerToken()) {
    requestDetails.headers[
      'Authorization'
    ] = `Bearer ${storage.session.getBearerToken()}`;
  }

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (storage.session.getCurlirize()) {
    curlirize(request);
  }

  return request;
}

/**
 * Generates a release (Github or Npm) Axios API instance
 * @param {object} requestOverride Takes an object of AXIOS parameters that can be used to either add
 * on extra information or override default properties https://github.com/axios/axios#request-config
 *
 * @returns {AxiosInstance}
 */
export function generateReleaseApi(baseUrl, requestOverride = {}) {
  const requestDetails = {
    baseURL: baseUrl,
    timeout,
    headers: {
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
    },
    ...requestOverride,
    httpAgent: getHttpAgent(),
    httpsAgent: getHttpsAgent(),
    proxy: getProxy(),
  };

  const request = axios.create(requestDetails);

  // enable curlirizer output in debug mode
  if (storage.session.getCurlirize()) {
    curlirize(request);
  }

  return request;
}
