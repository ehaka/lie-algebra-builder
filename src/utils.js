import { tick } from "svelte";

export async function refreshMathjax() {
    await tick();
    MathJax.Hub.Queue(["Typeset",MathJax.Hub]);
}