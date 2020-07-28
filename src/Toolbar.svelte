<script>
    import { writable } from 'svelte/store';
    import { redolist, undolist, resetAll, brackets, grid, positions, vecs, modes, moveCallbacks, addUndo, selectedVector, showhelp, showexport, githublink, weights, mode, historylabels } from "./data";
    import { refreshMathjax } from "./utils.js"
    import { Rational, div } from 'rational-arithmetic';
    import copyTextToClipboard from 'copy-text-to-clipboard';

    let exportformat = "text";
    let selectElement = {};
    $: exportcontents = writeExportString(exportformat, $mode);

    $: undotext = setUndoText("undo",$undolist);
    $: redotext = setUndoText("redo",$redolist);
    $: undodisabled = $undolist.length==0;
    $: redodisabled = $redolist.length==0;

    const undotool = {id: "undo", src: "img/tools/undo.svg", func: undo};
    const redotool = {id: "redo", src: "img/tools/redo.svg", func: redo};
    const othertools = [
        {id: "reset", src: "img/tools/cancel.svg", func: reset},
        {id: "export", src: "img/tools/export.svg", func: exportData},
        {id: "help", src: "img/tools/help.svg", func: help},
        {id: "github", src: "img/tools/github.svg", func: github},
    ];

    function mathjaxToPlainText(label) {
        let out = label.replace("\\(","");
        out = out.replace("\\)","");
        out = out.replace("{","");
        out = out.replace("}","");
        return out;
    }

    function writeExportString(format, mode) {
        const labels = [];
        for(let i in $vecs) {
            labels.push(mathjaxToPlainText($vecs[i].label));
        }
        if(labels.length == 0) {
            return "";
        }

        let output = "";
        const one = new Rational(1,1);
        const negone = new Rational(1,1,-1);

        if(format == "text") {
            if(mode === "graded") {
                const layers = {};
                let anylayers = false;
                for(let i in $positions) {
                    const py = $positions[i][1];
                    if(!(py in layers)) {
                        layers[py] = [];
                    }
                    layers[py].push(labels[i]);
                    anylayers=true;
                }
                if(anylayers) {
                    output += "Layers\n"
                    const sortkey = (a, b) => parseInt(a) - parseInt(b);
                    const sorted = Object.keys(layers).sort(sortkey);
                    for(let i in sorted) {
                        const py = sorted[i];
                        output += py;
                        output += ": ";
                        output += layers[py].join(",");
                        output += "\n";
                    }
                    output += "\n";
                }
            }

            let anybrackets = false;
            for(let i in $brackets) {
                const cocycle = $brackets[i];
                let row = "";
                let brkt=false;
                for(let pair in cocycle) {
                    const [a,b] = pair.split(",");
                    if(a<b) {
                        brkt=true;
                        const val = cocycle[pair];
                        if(!val.equal(one)) {
                            let multstr;
                            if(val.equal(negone)) {
                                multstr="-"
                            } else {
                                multstr = val.denominator;
                                if(val.numerator!=1) {
                                    multstr += "/"+val.numerator;
                                }
                                multstr += "*";   
                            }
                            row += multstr;
                        }
                        row += "[";
                        row += mathjaxToPlainText($vecs[a].label);
                        row += ",";
                        row += mathjaxToPlainText($vecs[b].label);
                        row +="] = ";
                    }
                }
                if(brkt) {
                    row += mathjaxToPlainText($vecs[i].label);
                    //outputrows.push(row);
                    if(!anybrackets) {
                        anybrackets=true;
                        output+="Brackets\n"
                    }
                    output+=row+"\n";
                }
            }
        }
        else if(format == "sage") {
            const commutators = {};
            for(let i in $brackets) {
                const cocycle = $brackets[i];
                let row = "";
                let brkt=false;
                for(let pair in cocycle) {
                    const val = cocycle[pair];
                    const [a,b] = pair.split(",");
                    if(a<b) {
                        if(!(pair in commutators)) {
                            commutators[pair] = {};
                        }
                        commutators[pair][i] = val;
                    }
                }
            }
            let noelems = true;
            output = "sc = {";
            for(let pair in commutators) {
                if(noelems) {
                    noelems = false;
                    output += "\n";
                }
                const [a,b] = pair.split(",");
                output += "    ('";
                output += labels[a];
                output += "','";
                output += labels[b];
                output += "') : {";

                const terms = commutators[pair];
                const termstrs = [];
                for(let k in terms) {
                    const v = terms[k];
                    let s = "'";
                    s += labels[k];
                    s += "': ";
                    if(v.sign<0) {
                        s += "-";
                    }
                    s += v.numerator;
                    if(v.denominator != 1) {
                        s += "/";
                        s += v.denominator;
                    }
                    termstrs.push(s);
                }
                output += termstrs.join(",");
                output += "},\n";
            }

            output += "}\n";
            //output += "names = [";
            //output += labels.join(",");
            //output += "]\n";
            //output += "LieAlgebra(QQ, sc, names=names, nilpotent=True)\n";
            output += "L.<";
            output += labels.join(",");
            output += "> = ";
            output += "LieAlgebra(QQ, sc, nilpotent=True)\n";

            if(mode === "graded") {
                const layers = {};
                let anylayers = false;
                for(let i in $positions) {
                    const py = $positions[i][1];
                    if(!(py in layers)) {
                        layers[py] = [];
                    }
                    layers[py].push(labels[i]);
                    anylayers=true;
                }
                if(anylayers) {
                    output += "layers = {\n"
                    const sortkey = (a, b) => parseInt(a) - parseInt(b);
                    const sorted = Object.keys(layers).sort(sortkey);
                    for(let i in sorted) {
                        const py = sorted[i];
                        output += "    ";
                        output += py;
                        output += ": [";
                        output += layers[py].join(",");
                        output += "],\n";
                    }
                    output += "}\n";
                }
            }
        }
        return output;
    }

    function copyExport() {
        copyTextToClipboard(exportcontents);
        const el = document.getElementById("exportbox");
        el.focus();
        el.select();
    }

    function reversibleMove(move) {
        const pos = $positions[move.obj];
        const backmove = {
            type: historylabels.move,
            obj: move.obj,
            x: pos[0],
            y: pos[1]
        };
        $moveCallbacks[move.obj](move.x,move.y,false);
        return backmove;
    }

    function setUndoText(base, undolist) {
        const len = undolist.length;
        if(len > 0) {
            const action = undolist[len-1];
            base += " ";
            base += action.type;
        }
        return base;
    }

    function undo() {
        $showexport = false;
        $showhelp = false;
        const action = $undolist.pop();

        let redoaction;
        if(action.type === historylabels.removevector || action.type === historylabels.removebracket) {
            if(action.type == historylabels.removevector) {
                redoaction = {type: historylabels.addvector};
            }
            else {
                redoaction = {type: historylabels.addbracket};
            }

            redoaction.vector = $vecs.pop();
            redoaction.bracket = $brackets.pop();
            redoaction.weight = weights.pop();
            const id = $vecs.length;
            const pos = $positions[id];
            delete $positions[id];
            delete $grid[pos];

            //update dependencies
            $vecs = $vecs;
            $brackets = $brackets;
            $positions = $positions;
        } 
        else if(action.type === historylabels.move) {
            redoaction = reversibleMove(action);
        } 
        else if(action.type === historylabels.changemode) {
            redoaction = {type: historylabels.changemode, mode: $mode};
            $mode = action.mode;
        }
        $redolist.push(redoaction);

        // update dependencies
        $undolist = $undolist;
        $redolist = $redolist;
    }
    function redo() {
        $showexport = false;
        $showhelp = false;
        const action = $redolist.pop();

        let undoaction;
        if(action.type === historylabels.addbracket || action.type === historylabels.addvector) {
            if(action.type === historylabels.addbracket) {
                undoaction = {type: historylabels.removebracket};
            }
            else {
                undoaction = {type: historylabels.removevector};
            }

            vecs.update(l => [...l, action.vector]);
            brackets.update(l => [...l, action.bracket]);
            weights.push(action.weight);
            refreshMathjax();
        }
        else if(action.type === historylabels.move) {
            undoaction = reversibleMove(action);
        }
        else if(action.type === historylabels.changemode) {
            undoaction = {type: historylabels.changemode, mode: $mode};
            $mode = action.mode;
        }
        $undolist.push(undoaction);

        // update dependencies
        $undolist = $undolist;
        $redolist = $redolist;
    }

    function reset() {
        resetAll();
    }
    function exportData() {
        $showhelp=false;
        $showexport = !$showexport;
        if($showexport) {
            exportcontents = writeExportString(exportformat, $mode);
        }
    }
    function help() {
        $showexport=false;
        $showhelp = !$showhelp;
    }
    function github() {
        window.open(githublink);
    }
    function confirmModeChange() {
        if($brackets.length==0) {
            $mode = selectElement.value;
            return;
        }
        const nextmode = selectElement.value;
        if($mode == nextmode) {
            return;
        }

        // allow mode change only to less restrictive
        if(modes.indexOf(nextmode)<modes.indexOf($mode)) {
            const undo = {
                type: historylabels.changemode,
                mode: $mode
            };
            addUndo(undo);
            $mode = nextmode;
        }
    }
</script>
<style>
    .toolbar {
        position: fixed;
        display: flex;
        gap: 0px;
        padding: 4px;
        padding-left: 16px;
        padding-right: 16px;
        left: 50%;
        bottom: 32px;
        transform: translate(-50%, 0px);
		border-radius: 20px;
        border-style: groove;
		border-color: #000000;
		background-color: #d1d1d1;
        z-index: 1000;
    }
    .toolbar .tooltipcontainer {
        position: relative;
    }
    .tool {
        position: relative;
        width: 40px;
        height: 40px;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
		background-color: #d1d1d1;
        border-style: solid;
        border-color: #d1d1d1;
    }
    .tool:hover {
        border-style: outset;
        border-color: #ffffff;
    }
    .tool:active {
        border-style: inset;
        border-color: #ffffff;
    }
    .tool:disabled {
        opacity: 0.3;
		background-color: #d1d1d1;
        border-style: solid;
        border-color: #d1d1d1;
    }
    .tool + .hint {
        position: absolute;
        left: 50%;
        bottom: 0;
        white-space: nowrap;
        transform: translate(-50%, 28px);
        visibility: hidden;
        border-style: none;
        background-color: #ffffff;
    }
    .tool:hover + .hint {
        visibility: visible;
    }
    .exportdlg {
        display: block;
        position: absolute;
        left: 50%;
        top: 10%;
        width: min(700px,80%);
        height: 70%;
        transform: translate(-50%, 0);
		border-radius: 20px;
        border-style: groove;
		border-color: #000000;
		background-color: #e1e1e1;
        padding: 8px;
        z-index: 1001;
        visibility: hidden;
    }
    .exportdlg .text {
        position: absolute;
        display: block;
        left: 8px;
        right: 12px;
        top: 8px;
        bottom: 48px;
    }
    .exportdlg .text textarea {
        position: absolute;
        width: 100%;
        height: 100%;
        border-style: solid;
        border-width: 1px;
		border-color: #000000;
		background-color: #ffffff;
        resize: none;
    }
    .exportdlg .buttons {
        position: absolute;
        display:flex;
        left: 8px;
        right: 8px;
        bottom: 8px;
    }
    .exportdlg .buttons .typebuttons {
        display: inherit;
        position: absolute;
        gap: 16px;
        right: 0;
        bottom: 0;
    }
    .exportdlg .buttons .copy {
        display: inherit;
        position: absolute;
        left: 0;
        bottom: 0;
    }
    .helpdlg {
        display: block;
        position: absolute;
        top: 10%;
        width: min(550px,80%);
        left: 50%;
        max-height: 70%;
        transform: translate(-50%, 0);
		border-radius: 20px;
        border-style: groove;
		border-color: #000000;
		background-color: #f1f1f1;
        padding: 8px;
        z-index: 1001;
        visibility: hidden;
        overflow-y: auto;
        margin: 8px;
    }
    .show {
        visibility: visible;
    }
</style>

<div class="toolbar">
    <select class="modeselect" 
    bind:this={selectElement} 
    on:change={confirmModeChange}
    value={$mode}>
        {#each modes as modeopt,i}
        <option disabled={$brackets.length>0 && i>modes.indexOf($mode)}>{modeopt}</option>
        {/each}
    </select>
    <div class="tooltipcontainer">
        <button id={undotool.id} class="tool" disabled={undodisabled} on:click={undotool.func}
        style="background-image: url({undotool.src});">
        </button>
        <span class="hint">{undotext}</span>
    </div>
    <div class="tooltipcontainer">
        <button id={redotool.id} class="tool" disabled={redodisabled} on:click={redotool.func}
        style="background-image: url({redotool.src});">
        </button>
        <span class="hint">{redotext}</span>
    </div>
    {#each othertools as tool}
    <div class="tooltipcontainer">
        <button id={tool.id} class="tool" on:click={tool.func}
        style="background-image: url({tool.src});">
        </button>
        <span class="hint">{tool.id}</span>
    </div>
    {/each}
</div>
<div class="exportdlg{$showexport ? " show" : ""}">
    <div class="text">
        <textarea id="exportbox" bind:value={exportcontents}></textarea>
    </div>
    <div class="buttons">
        <div class="copy">
            <button on:click={copyExport}>Copy</button>
        </div>
        <div class="typebuttons">
            <button on:click={() => exportformat = "text"}>Text</button>
            <button on:click={() => exportformat = "sage"}>Sage</button>
        </div>
    </div>
</div>
<div class="helpdlg{$showhelp ? " show" : ""}">
    <h1>Instructions</h1>
    <p>Choose a Lie algebra type:</p>
    <ul>
        <li>nilpotent: no restrictions on central extensions</li>
        <li>graded: the Lie algebra is graded over the integers</li>
    </ul>
    <p>Click on empty space to add an abelian factor.</p>
    <p>Click a vector \(X_i\) to select it, then select another 
        vector \(X_j\) to define a central extension involving 
        the commutator \([X_i,X_j]\).</p>
    <p>Drag vectors to move them.</p>
    <p>Drag empty space to move the camera.</p>
</div>