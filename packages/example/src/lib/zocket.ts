import { createZocketReact } from "@zocket/react";
import type { AppRouter } from "../../server";

export const zocket = createZocketReact<AppRouter>();
