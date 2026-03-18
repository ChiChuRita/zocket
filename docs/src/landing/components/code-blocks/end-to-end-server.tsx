import { Highlight, themes } from "prism-react-renderer";

const title = "server.ts";
const code = `import { z } from "zod";
import { actor, createApp } from "@zocket/core";

const ChatRoom = actor({
  state: z.object({
    messages: z.array(z.object({
      from: z.string(),
      text: z.string(),
    })).default([]),
  }),

  methods: {
    sendMessage: {
      input: z.object({ from: z.string(), text: z.string() }),
      handler: ({ state, input, emit }) => {
        state.messages.push(input);
        emit("newMessage", input);
      },
    },
  },

  events: {
    newMessage: z.object({ from: z.string(), textt: z.string() }), // whoops, typo
  },
});

export const app = createApp({ actors: { chat: ChatRoom } });`;

export function EndToEndServerExample() {
  return (
    <div className="ctn flex w-full flex-col rounded-md xl:rounded-2xl">
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
            className="flex flex-col overflow-auto rounded-b-2xl p-2 text-xs xl:p-6 xl:text-base"
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="relative">
                {line.map((token, key) => (
                  <span
                    key={key}
                    {...getTokenProps({ token })}
                    className={
                      token.content === "textt"
                        ? "underline decoration-red-600 decoration-wavy"
                        : ""
                    }
                  />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
