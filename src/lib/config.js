import Conf from 'conf';

const schema = {
  apiKey: { type: 'string', default: '' }
};

const config = new Conf({ projectName: 'snippkit-cli', schema });

export const getApiKey = () => config.get('apiKey');
export const setApiKey = (key) => config.set('apiKey', key);
export const deleteApiKey = () => config.delete('apiKey');
export const clearConfig = () => config.clear();