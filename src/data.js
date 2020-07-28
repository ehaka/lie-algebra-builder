import { derived, readable, writable } from 'svelte/store';
import { spring } from 'svelte/motion';

// misc constants
export const githublink = "https://github.com/ehaka/lie-algebra-builder";
export const modes = [
    "nilpotent",
    "graded"
];

// layout data
export const gridsize = writable(70);
export const sqmin = readable(32);
export const showhelp = writable(false);
export const showexport = writable(false);

// logic
export const selectedVector = writable(-1);
export const actualMove = readable(16);

export const disabled = writable({});
export const grid = writable({});
export const positions = writable({});
export const moveCallbacks = writable({});
export const mode = writable(modes[1]);

export const brackets = writable([]);
export let weights = [];
export const vecs = writable([]);

export const camera = spring(
    { x: 0, y: 0 }, 
    {stiffness: 1, damping: 1}
    );

// undo/redo handling
export const historylabels = {
    move: "move",
    removevector: "add vector",
    removebracket: "central extension",
    addvector: "add vector",
    addbracket: "central extension",
    changemode: "change mode"
};
export const redolist = writable([]);
export const undolist = writable([]);
export function addUndo(a) {
    undolist.update(l => [...l, a]);
    redolist.set([]);   
}

// derived data
export const buffer = derived(gridsize, $gridsize => $gridsize/6);

// state save/load functions
export function resetAll() {
    selectedVector.set(-1);
    disabled.set({});
    showexport.set(false);
    showhelp.set(false);

    grid.set({});
    positions.set({});
    moveCallbacks.set({});
    
    brackets.set([]);
    vecs.set([]);
    weights=[];
    
    camera.stiffness = 1;
    camera.damping = 1;
    camera.update($camera => ({x: 0,y: 0}));

    redolist.set([]);
    undolist.set([]);
}