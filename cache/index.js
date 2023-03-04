const { existsSync, writeFileSync, readFileSync } = require('fs');
const { join } = require('path');

const getPath = name => join(__dirname, `./files/${name}.json`);

const getJson = path => {
  // 不存在，返回空对象
  if (!existsSync(path)) {
    return {};
  }
  // 读文件
  let string = readFileSync(path).toString();
  let cacheJson = {};

  try {
    // 反序列化
    cacheJson = JSON.parse(string);
  } catch {}

  return cacheJson;
};

function get(name, key) {
  const path = getPath(name);
  const json = getJson(path);
  return json[key];
}

function set(name, key, value) {
  const path = getPath(name);
  const json = getJson(path);
  json[key] = value;
  writeFileSync(path, JSON.stringify(json));
}

module.exports = { get, set };
