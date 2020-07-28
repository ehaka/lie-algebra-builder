<script>
	import { createEventDispatcher } from 'svelte';
	import { spring } from 'svelte/motion';
	import { derived } from 'svelte/store';
	import { cannotBracket, centralExtensionBasis, extensions } from './centralextension.js';
	import { brackets, buffer, camera, disabled, grid, gridsize, moveCallbacks, positions, selectedVector, addUndo, sqmin, actualMove, mode, weights, historylabels } from './data.js';

	let x;
	let y;
	let moved;
	$: inmotion=moved>$actualMove;
	const dispatch = createEventDispatcher();
	export let initx;
	export let inity;
	export let id;
	export let label;
	let coords = spring({ x: initx*$gridsize, y: inity*$gridsize }, {stiffness: 1, damping: 1});
	let prevpos = [initx,inity]; // last valid grid position
	$: $moveCallbacks[id] = gotoGridPos;
	$: gx = Math.round($coords.x/$gridsize);
	$: gy = $mode === "nilpotent" ? Math.round($coords.y/$gridsize) : prevpos[1];
	$: snapx = gx*$gridsize;
	$: snapy = gy*$gridsize;
	$: sqsize = Math.max($sqmin, $gridsize-2*$buffer);
	$: offset = -sqsize/2;
	$: $positions[id] = prevpos;

	// style helper variables
	$: selected = ($selectedVector == id);
	$: invalidbracket = cannotBracket($extensions, $selectedVector, id);
	$: nobracket = ($selectedVector>=0 && !selected && invalidbracket);
	$: $disabled[id] = nobracket;

	function gotoGridPos(gridx, gridy, soft) {
		if(soft) {
			coords.stiffness = 0.3;
			coords.damping = 0.7;
		}
		else {
			coords.stiffness = coords.damping = 1;
		}
		delete $grid[prevpos];

		$positions[id] = [gridx,gridy];
		weights[id] = gridy;
		$grid[[gridx,gridy]] = id;
		coords.set({x: gridx*$gridsize, y:gridy*$gridsize});
		prevpos = [gridx, gridy];
	}


	function toggleSelect() {
		if($selectedVector == id) {
			$selectedVector = -1;
		}
		else {
			$selectedVector = id;
		}
	}

	function handleMousedown(event) {
		coords.stiffness = coords.damping = 1;
		x = event.clientX;
		y = event.clientY;
		moved = 0;

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
		coords.update($coords => ({
			x: $coords.x + dx,
			y: $coords.y + dy
		}));
	}
	function handleMouseup(event) {
		x = event.clientX;
		y = event.clientY;
		window.removeEventListener('mousemove', handleMousemove);
		window.removeEventListener('mouseup', handleMouseup);

		if(!inmotion) {
			if($selectedVector>=0) {
				if(!invalidbracket) {
					dispatch("bracket", {
						id1: $selectedVector, 
						id2: id
					});
				}
				$selectedVector = -1;
			}
			else {
				toggleSelect();
			}
		}
		inmotion=false;

		const pos = [gx, gy];
        if(pos in $grid) {
			const other = $grid[pos];
            if(other == id) {
                // object did not move
				gotoGridPos(gx,gy,true);
                return;
            }
            // object dropped on top of a different object
			gotoGridPos(prevpos[0],prevpos[1],true);
        }
        else {
            // object dropped in free location

			// add move back to undolist
			const undo = {
				type: historylabels.move,
				obj: id,
				x: prevpos[0],
				y: prevpos[1]
			};
			gotoGridPos(gx,gy,true);
			addUndo(undo);
        }
	}
</script>

<style>
	.box {
		position: absolute;
		border-radius: 4px;
		border-style: outset;
		border-color: #000000;
		background-color: lightgray;
        text-align: center;
		user-select: none;
		left: 0;
	}
	.ghost {
		opacity: 0.2;
	}
	.selected {
		background-color: white;
	}
	.nobracket {
		opacity: 0.4;
	}
</style>

{#if inmotion}
<div class="box ghost"
	style="width: {sqsize}px;
	height: {sqsize}px;
	left: {offset}px;
	top: {offset}px;
	line-height: {sqsize}px;
	transform: translate({snapx+$camera.x}px,{snapy+$camera.y}px)"
></div>
{/if}
<div class="box"
	class:selected
	class:nobracket
	on:mousedown={handleMousedown}
	style="width: {sqsize}px;
	height: {sqsize}px;
	left: {offset}px;
	top: {offset}px;
	line-height: {sqsize}px;
	cursor: {inmotion ? 'move' : 'auto'};
	transform: translate({$coords.x+$camera.x}px,{$coords.y+$camera.y}px)"
>{label}</div>