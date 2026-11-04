import { build } from "esbuild";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = process.cwd();
const cssDirectory = resolve(root, ".next/static/css");
const styles = (await readdir(cssDirectory))
  .filter((file) => file.endsWith(".css"))
  .sort();
if (!styles.length)
  throw new Error("먼저 npm run build를 실행해 스타일을 생성하세요.");
const css = (
  await Promise.all(
    styles.map((file) => readFile(resolve(cssDirectory, file), "utf8")),
  )
).join("\n");
const csv = await readFile(
  resolve(root, "public/practice/checkout-devices.csv"),
  "utf8",
);
const csvURL = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
const result = await build({
  absWorkingDir: root,
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Explorer from './src/components/explorer'; createRoot(document.getElementById('root')).render(<Explorer />);`,
    resolveDir: root,
    sourcefile: "preview-entry.tsx",
    loader: "tsx",
  },
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  tsconfig: resolve(root, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  metafile: true,
  plugins: [
    {
      name: "inline-practice-csv",
      setup(builder) {
        builder.onLoad(
          { filter: /components\/exploration\.tsx$/ },
          async ({ path }) => {
            const source = await readFile(path, "utf8");
            if (!source.includes('href="/practice/checkout-devices.csv"'))
              throw new Error(
                "CSV 링크 형식 변경: 미리보기 빌더를 확인하세요.",
              );
            return {
              contents: source.replace(
                'href="/practice/checkout-devices.csv"',
                `href="${csvURL}"`,
              ),
              loader: "tsx",
            };
          },
        );
      },
    },
  ],
});
const external = Object.values(result.metafile.outputs)
  .flatMap((output) => output.imports)
  .filter((imp) => imp.external);
if (external.length)
  throw new Error("미리보기는 외부 JavaScript 의존성이 없어야 합니다.");
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>17job · 바로 사용하는 테스트</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await mkdir(resolve(root, "preview"), { recursive: true });
await writeFile(resolve(root, "preview/17job-test.html"), html);
console.log(
  `preview/17job-test.html 생성 완료 · ${Buffer.byteLength(html).toLocaleString()} bytes · 외부 스크립트 없음`,
);
