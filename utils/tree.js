const { getSummaryWithCache } = require('./ai');
const { writeKnowledge, writeContentTree } = require('./fs');
const { shortenContent } = require('./content');
const { encode } = require('gpt-3-encoder');

function getParentNo(titleNo) {
  const parentNo = titleNo.split('.').slice(0, -1).join('.');
  return parentNo;
}

// 构建嵌套树
function toNestTree(flattenTree) {
  const tree = [];
  // 构建一个节点 map
  const nodesMap = flattenTree.reduce((acc, cur) => {
    acc[cur.titleNo] = cur;
    return acc;
  }, {});

  function updateParentTokenLength(node, tokenLength) {
    const parentNo = getParentNo(node.titleNo);
    if (parentNo && nodesMap[parentNo]) {
      const parentNode = nodesMap[parentNo];
      // 增加父节点的内容长度
      parentNode.allTokenLength =
        (parentNode.allTokenLength || 0) + tokenLength;
      // 递归累加
      updateParentTokenLength(parentNode, tokenLength);
    }
  }

  // 构建嵌套节点树，并计算每个节点涵盖的内容字符串总长度
  flattenTree.forEach(node => {
    // 更新相关节点的token长度
    const { tokenLength, summaryTokenLength } = node;
    const currentTokenLength = summaryTokenLength || tokenLength;
    // 用自己节点的内容初始化自身内容长度
    // 初始时可能已经被自己的子节点初始化过了，因此是累加
    node.allTokenLength = (node.allTokenLength || 0) + currentTokenLength;
    updateParentTokenLength(node, currentTokenLength);

    const parentNo = getParentNo(node.titleNo);
    // 把节点插入到父节点中
    if (parentNo && nodesMap[parentNo]) {
      const parentNode = nodesMap[parentNo];
      parentNode.children.push(node);
    } else {
      tree.push(node);
    }
  });

  return tree;
}

// 文本节点tokens大于1000的，重构为摘要
async function rebuildTreeWithAISummary(docTree, pdfName) {
  for (let index = 0; index < docTree.length; index++) {
    const node = docTree[index];

    if (node.tokenLength > 1000 && !node.summary) {
      // 实在特别长的，再压缩一下
      // const { content, tokenLength } =
      //   node.tokenLength < 3600
      //     ? node
      //     : {
      //         content: shortenContent(node.content),
      //       };

      const { content, tokenLength } = node;
      node.summary = await getSummaryWithCache(
        { content, tokenLength },
        pdfName,
      );
      console.log('build summary success', node.titleNo);
    }

    if (node.summary && !node.summaryTokenLength) {
      node.summaryTokenLength = encode(node.summary).length;
    }
  }
  return docTree;
}

// 构建嵌套内容树，并将过长子节点做摘要优化，减少节点内容
async function buildNestTreeWithAISummary(docTree, pdfName) {
  const tree = await rebuildTreeWithAISummary(docTree, pdfName);
  const nestTree = toNestTree(tree);

  // 写入文件
  writeContentTree(pdfName, nestTree);
  return nestTree;
}

// 将多段内容合并为一段
function unionContent(node) {
  let content = `第${node.titleNo}节内容:` + (node.summary || node.content);

  node.children.forEach(child => {
    content = content + '|' + unionContent(child);
  });

  return content;
}

// 将嵌套树递归构建为打平的内容段落
function buildContents(nodes, contents) {
  const newContents = contents || [];
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if (node.allTokenLength > 3000) {
      buildContents(node.children, newContents);
    } else {
      const content = unionContent(node);
      newContents.push(content);
    }
  }
  return newContents;
}

// 构建知识库
async function buildKnowledgeFromDocTree(docTree, pdfName) {
  const nestTree = await buildNestTreeWithAISummary(docTree, pdfName);
  // const fs = require('fs');
  // fs.writeFileSync('./tempNestTree.json', JSON.stringify(nestTree));
  const knowledge = buildContents(nestTree);
  // 写入文件
  writeKnowledge(pdfName, knowledge);
  return knowledge;
}

module.exports = { buildKnowledgeFromDocTree };
