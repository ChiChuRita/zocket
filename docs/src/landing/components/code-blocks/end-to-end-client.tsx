import { Highlight, themes } from "prism-react-renderer";

const title = "client.ts";
const code = `import { createClient } from "@zocket/client";
import type { app } from "./server";

const client = createClient<typeof app>({
  url: "ws://localhost:3000",
});

const room = client.chat("general");

await room.sendMessage({ from: "Alice", text: "Hi!" });

room.state.subscribe((s) => {
  console.log(s.|) // autocomplete works like a charm
});`;

export function EndToEndClientExample() {
  return (
    <div className="relative">
      <div className="ctn absolute left-[168px] top-[223px] z-10 flex flex-col gap-1 rounded-sm border-2 border-[454545] px-2 py-0.5 xl:left-[238px] xl:top-[340px]">
        <div className="flex h-fit w-fit items-center gap-2">
          <img src="/symbol-field.svg" className="h-3 w-3" alt="symbol field" />
          <div className="text-[0.75rem] text-[#9CDCFE] xl:text-[1rem]">
            messages: Message[]
          </div>
        </div>
        <div className="flex h-fit w-fit items-center gap-2">
          <img src="/symbol-field.svg" className="h-3 w-3" alt="symbol field" />
          <div className="text-[0.75rem] text-[#9CDCFE] xl:text-[1rem]">
            online: number
          </div>
        </div>
      </div>
      <div className="ctn flex w-full flex-col overflow-visible rounded-md xl:rounded-2xl">
        <div className="flex flex-row gap-4 px-2 py-1 xl:px-6 xl:pb-1 xl:pt-4">
          <div className="flex basis-1/3 flex-row gap-2 py-2">
            <div className="h-3 w-3 rounded-full bg-[#F31260] xl:h-4 xl:w-4"></div>
            <div className="h-3 w-3 rounded-full bg-[#F5A524] xl:h-4 xl:w-4"></div>
            <div className="h-3 w-3 rounded-full bg-[#17C964] xl:h-4 xl:w-4"></div>
          </div>
          <div className="flex w-full basis-1/3 flex-row items-center justify-center gap-2 rounded-md px-2">
            <h2 className="text-sm text-white xl:text-lg ">{title}</h2>
          </div>
          <div className="basis-1/3"></div>
        </div>
        <Highlight code={code} language="tsx" theme={themes.vsDark}>
          {({ style, tokens, getLineProps, getTokenProps }) => (
            <pre
              style={{
                ...style,
                backgroundColor: "transparent",
              }}
              className="flex flex-col overflow-x-auto overflow-y-visible rounded-b-2xl p-2 text-xs xl:p-6 xl:text-base"
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="relative">
                  {line.map((token, key) => (
                    <span
                      key={key}
                      {...getTokenProps({ token })}
                      className={token.content === "|" ? "animate-blicking" : ""}
                    />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}
