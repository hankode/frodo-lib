import util from 'util';
import { generateAmApi } from './BaseApi';
import { getCurrentRealmPath } from './utils/ApiUtils';
import storage from '../storage/SessionStorage';

const oauthProviderServiceURLTemplate =
  '%s/json%s/realm-config/services/oauth-oidc';

const apiVersion = 'protocol=2.1,resource=1.0';
const getApiConfig = () => {
  const configPath = getCurrentRealmPath();
  return {
    path: `${configPath}/authentication/authenticationtrees`,
    apiVersion,
  };
};

/**
 * Get OAuth2 Provider
 * @returns {Promise} a promise that resolves to an object containing an OAuth2Provider object
 */
export async function getOAuth2Provider() {
  const urlString = util.format(
    oauthProviderServiceURLTemplate,
    storage.session.getTenant(),
    getCurrentRealmPath()
  );
  return generateAmApi(getApiConfig()).get(urlString, {
    withCredentials: true,
  });
}
