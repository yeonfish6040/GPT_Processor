import * as worker_threads from "worker_threads";

import * as AGPT_constant from "../map/AGPT_constant";

test("Auto-GPT JJAP", () => {
    let Worker = new worker_threads.Worker("./functions/AGPT_core.ts");
    Worker.postMessage({ evt: AGPT_constant.parent.tStart, uid: "test", task: "Help me with marketing my business" })
})