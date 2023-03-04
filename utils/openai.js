const { Configuration, OpenAIApi } = require('openai');
const { apiKey } = require('../config');

const configuration = new Configuration({
  apiKey,
});

const openai = new OpenAIApi(configuration);

module.exports = openai;
