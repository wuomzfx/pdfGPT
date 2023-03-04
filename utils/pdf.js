const pdfjs = require('pdfjs-dist');
const { encode } = require('gpt-3-encoder');
const {
  isDiseaseIntro,
  shortenDiseaseIntro,
  shortenContent,
} = require('./content');

// 封面
const PAGE_TYPE_COVER = 0;
// 目录
const PAGE_TYPE_CATALOG = 1;
// 正文
const PAGE_TYPE_MAIN = 2;

const TITLE_SPLIT = '__TITLE__';
const QUOTE_SPLIT = '__QUOTE__';
const REF_SPLIT = '__REF__';

function buildDocTree(longStr) {
  const [, ...sections] = longStr.split(TITLE_SPLIT); // 将字符串划分成 section 数组

  const treeNodes = sections
    .map(section => {
      let [titleNo, ...content] = section.split(' ');
      if (titleNo.endsWith('.')) {
        titleNo = titleNo.slice(0, -1);
      }

      const matchedTitleNo = titleNo.match(/^\d+(\.\d*)*\.?/)?.[0];

      let joinedContent = content.join(' ');

      // 说明标题中有非纯数字标题的内容，把这部分内容拼接到正文中
      if (matchedTitleNo !== titleNo) {
        const titleContent = titleNo.replace(/^\d+(\.\d*)*\.?/, '');
        joinedContent = titleContent + ' ' + joinedContent;
      }

      let tokenLength = encode(joinedContent).length;

      // 疾病介绍内容特别长，可以阉割掉具体疾病的详细信息
      if (isDiseaseIntro(tokenLength, joinedContent)) {
        joinedContent = shortenDiseaseIntro(joinedContent);
      } else if (tokenLength > 4000) {
        // 不是疾病介绍也特别长的，采用字典压缩法压缩
        joinedContent = shortenContent(joinedContent);
      }

      tokenLength = encode(joinedContent).length;

      return {
        titleNo: matchedTitleNo || titleNo,
        content: joinedContent,
        children: [],
        refs: [],
        tokenLength,
      };
    })
    // .map(node => {
    //   const { content } = node;

    //   if (content.indexOf(QUOTE_SPLIT)) {
    //     const regex = /__QUOTE__([0-9.]+)/g;
    //     let match;
    //     while ((match = regex.exec(content)) !== null) {
    //       node.refs.push(match[1]);
    //     }
    //     node.content = node.content
    //       .replace(regex, '')
    //       .replace(/第\s*\d+\s*页\s*共\d+页/g, '');
    //     return node;
    //   }
    // });
  return treeNodes;
}

function isCatalogPage({ items }) {
  const pageContent = items.map(i => i.str).join('');
  if (pageContent.indexOf('条款目录') > -1) {
    return true;
  }
  if (pageContent.split(/(?=\d+.\d+)/).length > 10) {
    return true;
  }
}

// 将注释内容拼接到正文中
function moveNoteToMain(items) {
  const { mainFontHeight, titlePositionX, pageNumberPositionY } =
    getPageMetaData(items);

  const isRefTitle = item =>
    Math.abs(item.transform[4] - titlePositionX) < 2 &&
    item.height / mainFontHeight < 0.7;

  const refSplitIndex = items.findIndex(isRefTitle);

  if (refSplitIndex < 0) {
    return items;
  }

  // 正文
  const mainItems = items.slice(0, refSplitIndex);
  // 注释
  items
    .slice(refSplitIndex)
    .map(refItem => {
      if (isRefTitle(refItem)) {
        refItem.str = `${REF_SPLIT}${refItem.str.trim()} `;
      }
      return refItem.str;
    })
    .join('')
    .split(REF_SPLIT)
    .forEach(refContent => {
      const [refNo, ...content] = refContent.split(' ');
      if (refNo && content.length) {
        const mainItem = mainItems.find(i => i.str.trim() === refNo);

        if (!mainItem) {
          return;
        }
        mainItem.str = `[${content.join('')}]`;
      }
    });
  return mainItems;
}

async function getPdfItems(pdfPath) {
  const pdfItems = [];
  let pageType = PAGE_TYPE_CATALOG;
  await pdfjs.getDocument(pdfPath).promise.then(doc => {
    const numPages = doc.numPages;
    let lastPromise = doc.getMetadata();

    const loadPage = function (pageNum) {
      return doc.getPage(pageNum).then(page => {
        return page
          .getTextContent({
            disableCombineTextItems: true,
            // includeMarkedContent: true,
          })
          .then(pageData => {
            // 如果之前是封面，当前页已经是目录页了，状态改为目录页
            if (pageType === PAGE_TYPE_COVER && isCatalogPage(pageData)) {
              pageType = PAGE_TYPE_CATALOG;
            }
            // 如果之前是目录页，当前页已经不是目录页，状态改为正文页
            if (pageType === PAGE_TYPE_CATALOG && !isCatalogPage(pageData)) {
              pageType = PAGE_TYPE_MAIN;
            }
            // 从正文开始，push内容
            if (pageType === PAGE_TYPE_MAIN) {
              const contentItems = pageData.items.map(i => ({ ...i, pageNum }));
              pdfItems.push(...moveNoteToMain(contentItems));
            }
            page.cleanup();
          });
      });
    };
    // Loading of the first page will wait on metadata and subsequent loadings
    // will wait on the previous pages.
    for (let i = 1; i <= numPages; i++) {
      lastPromise = lastPromise.then(() => loadPage(i));
    }
    return lastPromise;
  });
  return pdfItems;
}

const isTitleNo = (items, itemIndex) => {
  const item = items[itemIndex];
  const nextItem = items[itemIndex + 1];

  const { str: itemContent } = item;
  // 一般来说，太长字符的肯定不是标题，减少后续的正则校验开销
  if (itemContent.length > 20) {
    return false;
  }

  if (nextItem && nextItem.str.trim() === '页') {
    return item;
  }

  return /^\d+(\.\d*)*\.?/.test(itemContent.trim());
  // return /^\d+(\.\d*)*\.?$/.test(itemContent.trim());
};

function getPageMetaData(items) {
  const fontHeightCountMap = {};
  const numberPositionXCountMap = {};
  let minPositionY = Infinity;

  items.forEach((cur, index) => {
    const { height, transform } = cur;
    const positionX = transform[4];
    const positionY = transform[5];
    if (!height || !transform) {
      console.log(cur);
    }
    const isTitle = isTitleNo(items, index);

    fontHeightCountMap[height] = (fontHeightCountMap[height] || 0) + 1;

    minPositionY = Math.min(minPositionY, positionY);

    if (isTitle) {
      numberPositionXCountMap[positionX] =
        (numberPositionXCountMap[positionX] || 0) + 1;
    }
  }, {});

  const sortedHeights = Object.keys(fontHeightCountMap)
    .map(height => {
      return {
        height: Number(height),
        counts: fontHeightCountMap[height],
      };
    })
    .sort((a, b) => b.counts - a.counts);

  const sortedPositionXs = Object.keys(numberPositionXCountMap)
    .map(positionX => {
      return {
        positionX: Number(positionX),
        counts: numberPositionXCountMap[positionX],
      };
    })
    .filter(i => i.positionX < 100)
    .sort((a, b) => b.counts - a.counts);
  // 处于较左端的，否则会被有些列表项的数字污染

  return {
    // 使用最多的字体大小，有理由相信，它就是正文字体大小
    mainFontHeight: sortedHeights[0].height,
    // 即是数字，又是持续在一个x坐标体现的，有理由相信，它就是标题数字
    titlePositionX: sortedPositionXs?.[0]?.positionX,
    // 最靠底的部分，有理想相信，它是页码的位置。但要小于60，否则是无页码的PDF
    pageNumberPositionY: minPositionY < 60 ? minPositionY : undefined,
  };
}

function rebuildPdfItems(items) {
  const { titlePositionX, pageNumberPositionY, mainFontHeight } =
    getPageMetaData(items);
  return items
    .map((item, index) => {
      const { height: currentHeight, str: itemContent, transform } = item;
      const nextItem = items[index + 1];
      const prevItem = items[index - 1];
      const positionX = transform[4];
      const positionY = transform[5];

      // 页码数据不需要
      if (pageNumberPositionY === positionY) {
        return null;
      }

      if (itemContent.startsWith('附表')) {
        item.str = `${TITLE_SPLIT}${itemContent.trim()}`;
        return item;
      }

      if (!isTitleNo(items, index)) {
        return item;
      }

      // 大标题，允许一定误差
      if (Math.abs(positionX - titlePositionX) < 2) {
        item.str = `${TITLE_SPLIT}${itemContent.trim()}`;
        return item;
      }

      // const prevHeight = prevItem?.height;
      // const nextHeight = nextItem.height;

      // 引用注释
      // if (
      //   prevItem &&
      //   currentHeight < prevHeight &&
      //   currentHeight < nextHeight
      // ) {
      //   item.str = `${QUOTE_SPLIT}${itemContent}`;
      //   return item;
      // }

      return item;
    })
    .filter(Boolean);
}

async function buildDocTreeFromPdf(pdfPath) {
  const items = await getPdfItems(pdfPath);
  const itemsWithTreeInfo = rebuildPdfItems(items);
  // const fs = require('fs');
  // console.log('===');
  // fs.writeFileSync('./tempItems.json', JSON.stringify(itemsWithTreeInfo));
  return buildDocTree(itemsWithTreeInfo.map(i => i.str).join(''));
}

module.exports = {
  buildDocTreeFromPdf,
  getPdfItems,
  rebuildPdfItems,
};
