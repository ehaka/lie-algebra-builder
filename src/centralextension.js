import { derived } from 'svelte/store';
import { Rational, sub, mul, div } from 'rational-arithmetic';
import { brackets, mode, weights } from './data.js';
export const extensions = derived([brackets, mode], centralExtensionBasis);

function elimZero(matrix) {
    // clear zero elements from rows of the matrix
    for(let r in matrix) {
        const row = matrix[r];
        for(let c in row) {
            if(isZero(row[c])) {
                delete row[c];
            }
        }
    }
}
function negateRational(r) {
    return new Rational(r.numerator, r.denominator, -r.sign);
}
function isZero(r) {
    return r.numerator == 0;
}

function divideRow(matrix, r, m) {
    // divide elements of row r by m
    const row = matrix[r];
    for(let c in row) {
        // rational-arithmetic division has a sign bug
        const rc = row[c];
        const d = div(rc,m);
        const sgn = rc.sign*m.sign;
        row[c] = new Rational(d.numerator, d.denominator, sgn);
    }
}
function subsRowWithMult(matrix, r1, r2, m) {
    // substract m*r1 from row r2
    const row1  = matrix[r1];
    const row2  = matrix[r2];
    for(let c in row1) {
        const val = mul(m,row1[c]);
        if(c in row2) {
            row2[c] = sub(row2[c], val);
        }
        else {
            row2[c] = negateRational(val);
        }
    }
}

function rationalGaussianElim(matrix, numrows) {
    // gaussian elimination for sparse matrix of
    // rationals with arbitrary column labels
    const pivotelems = {};
    const pivotcols = [];
    let r = 0;
    while(r<numrows) {
        const row = matrix[r];
        // choose any nonzero element as a pivot
        let pivot = null;
        for(let c in row) {
            const el = row[c];
            if(isZero(el)) {
                delete row[c];
            }
            else if(pivot===null) {
                pivot = c;
                pivotelems[r] = pivot;
                pivotcols.push(pivot);

                // normalize pivot element
                divideRow(matrix, r, el);
            }
        }
        if(pivot === null) {
            // zero row, eliminate row from matrix
            for(let r2=r; r2<numrows-1; r2++) {
                matrix[r2] = matrix[r2+1];
            }
            delete matrix[numrows-1];
                numrows--;
            continue;
        }

        // clear pivot column from other rows
        for(var r2=0;r2<numrows;r2++) {
            if(r2==r) {
                continue;
            }

            const row2 = matrix[r2];
            if(pivot in row2) {
                const val2 = row2[pivot];
                subsRowWithMult(matrix, r, r2, val2);
            }
        }
        r++;
    }

    return [pivotelems, pivotcols];
}

function computeKernel(matrix, numrows, cocycles) {
    // apply gaussian elimination on matrix
    const ret = rationalGaussianElim(matrix, numrows);
    const [pivotelems, pivotcols] = ret;
    // clear zeroes from sparse matrix
    elimZero(matrix);

    // compute a basis of the kernel
    const kernel = [];
    for(let i in cocycles) {
        const pair = cocycles[i];
        const pairstr = pair.toString();
        if(pivotcols.indexOf(pairstr)>-1) {
            continue;
        }
        // each non-pivot column [a,b] defines a basis element
        // where the coefficient of [x,y] is the negation of the 
        // coefficient of [a,b] from the row with pivotcolumn [x,y]
        const cocycle = {};
        cocycle[pair] = new Rational(1, 1);
        cocycle[[pair[1],pair[0]]] = new Rational(1, 1, -1);
        for(let r in matrix) {
            const row = matrix[r];
            if(pairstr in row) {
                const val = row[pair];
                const piv = pivotelems[r];
                const [x,y] = piv.split(",");
                cocycle[piv] = negateRational(val);
                cocycle[[y,x]] = val;
            }
        }
        kernel.push(cocycle);
    }

    return kernel;
}

export function centralExtensionBasis(params) {
    const [brackets, mode] = params;
    const len = brackets.length;

    let matrix;
    let numrows;
    if(mode === "nilpotent"){
        // store all cocycle constraints in one matrix
        matrix = {};
        numrows = 0;
    }
    else {
        // in modes 'carnot' and 'graded', store cocycle 
        // constraints of different degrees separately
        matrix = {};
        numrows = {};
    }
    for(let i=0;i<len-2;i++) {
        for(let j=i+1;j<len-1;j++) {
            for(let k=j+1;k<len;k++) {
                // add cocycle constraint from vectors i,j,k
                // B([ij],k) + B([jk],i) + B([ki],j)=0
                const row = {};

                // columns for E_ab-E_ba, i<j<a<k=b
                for(let a=j+1;a<k;a++) {
                    const el = [i,j];
                    if(el in brackets[a]) {
                        row[[a,k]] = brackets[a][el];
                    }
                }

                // columns for E_ab-E_ba, a=i,j,k < b
                const cyclic = [[i,j,k],[j,k,i],[k,i,j]];
                for(let h=0;h<3;h++) {
                    const [x,y,z] = cyclic[h];
                    for(let b=k+1;b<len;b++) {
                        const el = [x,y];
                        if(el in brackets[b]) {
                            const val = brackets[b][el];
                            row[[z,b]] = negateRational(val);
                        }
                    }    
                }

                if(Object.keys(row).length > 0) {
                    if(mode==="nilpotent") {
                        matrix[numrows] = row;
                        numrows++;
                    }
                    else {
                        // separate by degree of constraint
                        const deg = weights[i]+weights[j]+weights[k];
                        if(!(deg in matrix)) {
                            matrix[deg] = {};
                            numrows[deg] = 0;
                        }
                        matrix[deg][numrows[deg]] = row;
                        numrows[deg]++;
                    }
                }
            }
        }
    }

    if(mode==="nilpotent") {
        const cocycles = [];
        for(let a=0;a<len-1;a++) {
            for(let b=a+1;b<len;b++) {
                cocycles.push([a,b]);
            }
        }
        return computeKernel(matrix,numrows,cocycles);
    }
    // in graded modes the kernel is the direct sum of the homogeneous kernels
    const cocycles = {};
    for(let a=0;a<len-1;a++) {
        for(let b=a+1;b<len;b++) {
            const deg = weights[a]+weights[b];
            if(!(deg in cocycles)) {
                cocycles[deg] = [];
            }
            cocycles[deg].push([a,b]);
        }
    }
    const totalkernel = [];
    for(let deg in cocycles) {
        const coc = cocycles[deg];
        if(deg in matrix) {
            const mat = matrix[deg];
            const num = numrows[deg];
            const ker = computeKernel(mat, num, coc);
            totalkernel.push(...ker);
        }
        else {
            // no constraints, kernel is full component
            for(let i in coc) {
                const pair = coc[i];
                const cocycle = {}
                cocycle[pair] = new Rational(1, 1);
                cocycle[[pair[1],pair[0]]] = new Rational(1, 1, -1);
                totalkernel.push(cocycle);
            }
        }
    }
    return totalkernel;
    
}

export function cannotBracket(cocyclebasis, i, j) {
    // return true if there does not exist a 2-cocycle B with B(i,j) nonzero
    const key = [i,j];
    for(i in cocyclebasis) {
        const B = cocyclebasis[i];
        if(key in B) {
            return false;
        }
    }
    return true;
}