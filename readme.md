## 如何使用
1. 执行 `npm install` 或 `tnpm install`;
2. 下载一个保险条款 PDF，放在 `pdfs/` 这个目录下;
3. 在 `config.json` 中，配置你的 `apiKey` 以及你的 PDF 文档名;
4. 针对你的 PDF 文档，修改 `config.json` 中问题 `questions`;
5. 先执行 `npm run load`，如果异常报错了，可以继续重试;
6. 再执行 `npm run ask`;
7. 最终可以在 answerFiles 文件目录下看到答案记录