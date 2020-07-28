<script>
    import { cannotBracket, centralExtensionBasis, extensions } from './centralextension.js'
    import LieElement from "./LieElement.svelte";
    import Toolbar from "./Toolbar.svelte";
    import { refreshMathjax } from "./utils.js"
    import { actualMove, brackets, camera, disabled, grid, gridsize, positions, selectedVector, vecs, addUndo, showexport, showhelp, weights, mode, historylabels }from './data.js';
    import { onDestroy, onMount, tick } from "svelte";
    
    let x;
    let y;
	let moved;
	$: inmotion=moved>$actualMove;
    $: rows = Math.ceil(window.innerHeight/$gridsize);
    $: [firstlineh, startodd, firstrow] = firstLineHeight($camera.y);
    $: lines = updateLines($positions, $camera, $gridsize);
    $: displayrownumber = $mode != "nilpotent";

    function updateLineCount(event) {
        rows = Math.ceil(window.innerHeight/$gridsize);
    }

    function firstLineHeight(camy) {
        const firstrow = Math.round(-camy/$gridsize);
        camy = camy+$gridsize/2;
        let h = camy % (2*$gridsize);
        if(camy<0) {
            h += 2*$gridsize;
        }
        if(h>$gridsize) {
            return [h-$gridsize, true, firstrow];
        }
        return [h,false, firstrow];
    }

    async function updateLines(positions, camera, gridsize) {
        await tick();
        lines = [];

        for(let i in $brackets) {
            const cocycle = $brackets[i];
            for(let pair in cocycle) {
                // add a line a->i, where pair=a,b
                const a = pair.split(",")[0];
                const pos1 = positions[a];
                const pos2 = positions[i];
                const x1 = pos1[0]*gridsize+camera.x;
                const x2 = pos2[0]*gridsize+camera.x;
                const y1 = pos1[1]*gridsize+camera.y;
                const y2 = pos2[1]*gridsize+camera.y;
                const line = {x1, y1, x2, y2};
                line.class = "edge";

                // skip lines between incompatible when selected
                if($disabled[a] || $disabled[i]) {
                    line.class += " disabled";
                }
                lines.push(line);
            }
        }
        return lines;
    }

    function addVector(gx, gy) {
        // add an abelian factor
        const nextid = $vecs.length;
        const label = "\\(X_{" + (nextid+1) + "}\\)";
        $vecs.push({label: label, initx: gx, inity: gy});
        $vecs=$vecs; // assignment updates references
        $grid[[gx,gy]] = nextid;
        refreshMathjax();
        $positions[nextid] = [gx,gy];
        $brackets.push({});
        weights.push(gy);
        return nextid;
    }

    function emptyClick(x,y) {
        if($showexport || $showhelp) {
            $showexport=false;
            $showhelp=false;
            return;
        }
        const gx = Math.round(x/$gridsize);
        const gy = Math.round(y/$gridsize);
        const pos = [gx,gy];
        if(pos in $grid) {
            return;
        }
        addVector(gx,gy);

        // add vector removal to undolist
        const undo = {
            type: historylabels.removevector
        };
        addUndo(undo);

        $brackets = $brackets;
    }

    function createBracket(event) {
        // find closest free spot below the drop position
        const obj1 = event.detail.id1;
        const obj2 = event.detail.id2;

        // form list of all possible cocycles
        const cocycles = [];
        const pair=[obj1,obj2];
        for(let i in $extensions) {
            const cocycle = $extensions[i];
            if(pair in cocycle) {
                cocycles.push(cocycle);
            }
        }
        // choose first possible cocycle
        // TODO: present choices to the user somehow
        const brkt = cocycles[0];

        let gy;
        if($mode === "nilpotent") {
            // in nilpotent mode place elements just below the lowest
            gy = weights[obj1];
            for(let pair in brkt) {
                const [a,b] = pair.split(",");
                gy = Math.max(gy, weights[a], weights[b]);
            }
            gy++;
        }
        else {
            // in graded mode the weight is the sum of weights
            gy = weights[obj1]+weights[obj2];
        }

        // set x position halfway, or as close as possible
        const halfway = ($positions[obj1][0]+$positions[obj2][0])/2;
        let gx = Math.floor(halfway);
        let jump = 0;
        let sign = halfway>=gx ? -1 : 1;
        while([gx,gy] in $grid) {
            // alternate checking sides
            sign = -sign;
            jump++;
            gx = gx+sign*jump;
        }
        const obj3 = addVector(gx,gy);

        // add bracket relation between the elements
        $brackets[obj3] = brkt;

        // add vector removal to undolist
        const undo = {
            type: historylabels.removebracket
        };
        addUndo(undo);
    }

	function handleMousedown(event) {
        camera.stiffness = 1;
        camera.damping = 1;
		x = event.clientX;
        y = event.clientY;
        moved=0;

		window.addEventListener('mousemove', handleMousemove);
		window.addEventListener('mouseup', handleMouseup);
	}
	function handleMousemove(event) {
		const dx = event.clientX - x;
		const dy = event.clientY - y;
		if(!inmotion) {
			moved+=Math.abs(dx);
			moved+=Math.abs(dy);
		}
		x = event.clientX;
		y = event.clientY;
		camera.update($camera => ({
			x: $camera.x + dx,
			y: $camera.y + dy
		}));
	}
	function handleMouseup(event) {
        if(!inmotion) {
            emptyClick(event.clientX-$camera.x,event.clientY-$camera.y);
        }
        inmotion=false;
		window.removeEventListener('mousemove', handleMousemove);
        window.removeEventListener('mouseup', handleMouseup);
    }
    onMount(() => window.addEventListener('resize',updateLineCount));
    onDestroy(() => window.removeEventListener('resize',updateLineCount));
</script>

<style>
    .grid {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow-y: hidden;
    }
    .nodrag {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
    }
    .background {
        position: absolute;
        display: block;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        user-select: none;
    }
    .bgstripe {
        width: 100%;
    }
    .bgstripe:nth-child(odd) {
        background-color: #f1f1f1;
    }
    .bgstripe:nth-child(even) {
        background-color: #e8e8e8;
    }
    .edge {
        stroke: black;
        stroke-width: 2;
    }
    .disabled {
        stroke-width: 2;
        stroke-dasharray: 5 5;
        opacity: 0.2;
    }
    .linecanvas {
        position: absolute;
        display: block;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
    }
    .label {
        position: relative;
        left: 0;
        top: 0;
        height: 0%;
        line-height: 0px;
        background-color: inherit;
    }
</style>

<div class="grid">
    <div class="background nodrag" 
    on:mousedown={handleMousedown}
    style="cursor: {inmotion ? 'move' : 'auto'};"
    draggable="false">
        {#if startodd}
            <div class="bgstripe" 
            style="height: 0px;" />
            <div class="bgstripe" 
            style="height: {firstlineh}px;"></div>
        {:else}
            <div class="bgstripe" 
            style="height: {firstlineh}px;" ></div>
        {/if}
        {#each {length: rows} as _,i}
            <div class="bgstripe"
            style="height: {$gridsize}px;" >
            {#if displayrownumber}
                {firstrow+i+1}
            {/if}
            </div>
        {/each}
        {#await lines then drawlines}
        <svg class="linecanvas">
            {#each drawlines as line}
                <line {...line} />
            {/each}
        </svg>
        {/await}
    </div>
    {#each $vecs as vec,i}
        <LieElement id={i} {...vec}
        on:bracket={createBracket} />
    {/each}
    <Toolbar />
</div>  