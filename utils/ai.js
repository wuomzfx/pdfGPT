const crypto = require('crypto');
const { encode } = require('gpt-3-encoder');

const openai = require('./openai');
const cache = require('../cache');

function buildHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

async function createCompletion({
  prompt,
  max_tokens = 1024,
  temperature = 0,
}) {
  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt,
    max_tokens,
    temperature,
  });

  return strip(completion?.data?.choices?.[0].text, ['\n']).trim();
}

// 去头尾指定字符
const strip = (str, chars) => {
  let newStr = str;
  chars.forEach(char => {
    newStr = newStr.replace(new RegExp(`^${char}+|${char}+$`, 'g'), '');
  });
  return newStr;
};

const withCache =
  (wrappedFn, suffix, getContent) => async (arg, cacheFileName) => {
    const content = getContent(arg);
    const cacheName = `${cacheFileName}_${suffix}`;
    // 文本太长，hash一下
    const hash = buildHash(content);
    const cacheValue = cache.get(cacheName, hash);
    if (cacheValue) {
      return cacheValue;
    }

    const rs = await wrappedFn(arg);

    cache.set(cacheName, hash, rs);
    return rs;
  };

async function getSummary({ content, tokenLength }) {
  const promptContext =
    content.indexOf('|上文中a:') >= -1
      ? `'''{{content}}'''基于字典翻译并返回内容摘要：`
      : `'''{{content}}'''基于命名实体识别构建内容摘要：`;
  const contentTokenLength = tokenLength || encode(content).length;
  const promptContextTokenLength = encode(promptContext).length;

  const completion = await openai.createCompletion({
    model: 'text-davinci-003',
    prompt: promptContext.replace('{{content}}', content),
    // 1000 ~ 4096，最大也不能超过1000
    max_tokens: Math.min(
      4096 - contentTokenLength - promptContextTokenLength,
      1000,
    ),
    temperature: 0,
  });

  return strip(completion?.data?.choices?.[0].text, ['\n']);
}

async function createEmbedding(input) {
  const [response] = await Promise.all([
    openai.createEmbedding({
      model: 'text-embedding-ada-002',
      input: input,
    }),
    // 向量化很快，休息一下，防止调用超限(默认最多每分钟60次)
    await sleep(3000),
  ]);

  return response.data.data[0].embedding;
}

async function askInsQuestion({ question, knowledge }) {
  const prompt = `
    以下是某保险产品条款的部分
    '''${knowledge}'''
    请基于对保险的理解与该部分条款内容，回答如下问题：
    ${question}。
    答案：
    `;

  const promptTokenLength = encode(prompt).length;

  return createCompletion({ prompt, max_tokens: 4096 - promptTokenLength });
}

// 防止超过每分钟调用限制
const sleep = time =>
  new Promise(resolve => {
    setTimeout(resolve, time);
  });

module.exports = {
  sleep,
  getSummary,
  getSummaryWithCache: withCache(
    getSummary,
    'summary',
    ({ content }) => content,
  ),
  createEmbeddingWithCache: withCache(
    createEmbedding,
    'embedding',
    input => input,
  ),
  askInsQuestion,
  createCompletion,
};
