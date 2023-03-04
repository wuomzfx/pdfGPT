const path = require('path');
const nodejieba = require('nodejieba');

const LETTERS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZαβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'.split('');

nodejieba.load({
  userDict: path.join(__dirname, '../userdict.utf8'),
});

// 判断是否是疾病介绍
function isDiseaseIntro(tokenLength, joinedContent) {
  // 比较短就不处理了
  if (tokenLength < 2000) {
    return false;
  }
  // 粗暴的简单判断
  return !!['重大疾病', '中症疾病', '轻症疾病', '特定心脑血管疾病'].find(
    disease => joinedContent.indexOf(disease) === 0,
  );
}

// 疾病介绍的信息太长了，需要阉割一下，舍弃疾病介绍详情
function shortenDiseaseIntro(content) {
  const titleRegExp = /(?=（[0-9]+）)/g;
  const sections = content.split(titleRegExp).map(section => {
    if (titleRegExp.test(section)) {
      const [title, ..._] = section.split(' ');
      return title;
    }
    return section;
  });
  return sections.join('');
}

function shortenByDictionary(originContent, words, should) {
  let shortContent = originContent;
  const dictionary = [];
  const wordsCounts = words.reduce((acc, cur) => {
    acc[cur] = (acc[cur] || 0) + 1;
    return acc;
  }, {});

  Object.keys(wordsCounts).forEach(word => {
    if (should(wordsCounts[word], word.length)) {
      dictionary.push(word);
      shortContent = shortContent.replaceAll(
        word,
        `${LETTERS[dictionary.length - 1]}`,
      );
    }
  });
  shortContent = `${shortContent}|上文中，${dictionary.map(
    (word, index) => `${LETTERS[index]}:${word}`,
  )}`;
  return shortContent;
}

function shortenTableContent(tableContent) {
  const words = tableContent.split(' ');
  return shortenByDictionary(
    tableContent,
    words,
    (counts, length) => counts > 3 && length > 3,
  );
}

function shortenSectionContent(sectionContent) {
  const longContent = sectionContent
    // 去无不需要文案
    .replaceAll('（见释义）', '')
    // 减少字符
    .replaceAll('——', '—')
    // 全角半角化
    .replaceAll('（', '(')
    .replaceAll('）', ')')
    .replaceAll('：', ':')
    .replaceAll('；', ';')
    .replaceAll('、', '|')
    .replaceAll('，', ',')
    .replaceAll('。', '.')
    .replaceAll('“', `'`)
    .replaceAll('”', `'`)
    // 去无意义空格
    .replaceAll('. ', '.')
    .replaceAll(` '`, `'`)
    .replaceAll('; ', ';');
  const words = nodejieba.cut(longContent);
  return shortenByDictionary(
    longContent,
    words,
    (counts, length) => counts > 4 && length > 1,
  );
}

function shortenContent(longContent) {
  if (longContent.split(' ').length > 100) {
    return shortenTableContent(longContent);
  }
  return shortenSectionContent(longContent);
}

module.exports = {
  isDiseaseIntro,
  shortenDiseaseIntro,
  shortenContent,
  shortenTableContent,
  shortenSectionContent,
};
