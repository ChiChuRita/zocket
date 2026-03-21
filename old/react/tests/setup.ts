import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost:3000" });
const document = window.document;

// Provide minimal DOM globals for React Testing Library + bun:test
global.window = window as any;
global.document = document as any;
global.navigator = window.navigator as any;
global.requestAnimationFrame = ((cb: any) => setTimeout(cb, 0)) as any;
global.cancelAnimationFrame = clearTimeout as any;


