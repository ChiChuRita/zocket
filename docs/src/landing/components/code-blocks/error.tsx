import { Highlight, themes } from "prism-react-renderer";
import { CodeBlock } from "./code-block";

const clientCode = `const room = client.game("room-1");

try {
  await room.join({ name: "Alice" });
} catch (err) {
  if (err.code === "FORBIDDEN") {
    console.log(err.message); // "Room is full!"
  }
}
`;

const serverCode = `const GameRoom = actor({
  state: z.object({
    players: z.array(z.string()).default([]),
  }),

  methods: {
    join: {
      input: z.object({ name: z.string() }),
      handler: ({ state, input }) => {
        if (state.players.length >= 4) {
          throw new ZocketError({
            code: "FORBIDDEN",
            message: "Room is full!",
          });
        }
        state.players.push(input.name);
      },
    },
  },
});`;

export function ErrorClientExample() {
  const title = "client.ts";
  return (
    <div className="ctn flex h-full w-full flex-col rounded-md xl:rounded-2xl">
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
      <Highlight code={clientCode} language="tsx" theme={themes.vsDark}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            style={{
              ...style,
              backgroundColor: "transparent",
            }}
            className="flex h-full flex-col overflow-auto rounded-b-2xl p-2 text-xs xl:p-6 xl:text-base"
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="relative">
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

export function ErrorServerExample() {
  return <CodeBlock title="server.ts" code={serverCode} />;
}
