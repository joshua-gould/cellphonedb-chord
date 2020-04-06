let animateBtn = document.getElementById('animate');
let tooltip = d3.select('#tooltip');
let saveBtn = document.getElementById('save');
let margin = {left: 150, top: 150, right: 150, bottom: 150};
let width = Math.min(window.innerWidth, 750) - margin.left - margin.right;
let height = Math.min(window.innerWidth, 750) - margin.top - margin.bottom;
let innerRadius = Math.min(width, height) * .55;
let outerRadius = innerRadius + 6;
let chordDataArray = []; // contains matrix, names, items, svg, name, animationIndex
let animating = false;
let table = null;
let opacity = 0.7;
let fadedOpacity = 0.1;
let counter = 1;

function startAnimation() {
    animating = true;
    window.setTimeout(animateChords, 200);
}


animateBtn.addEventListener('click', function (e) {
    if (animating) {
        animateBtn.innerText = 'Play';
        animating = false;
    } else {
        animateBtn.innerText = 'Pause';
        startAnimation();
    }
});
saveBtn.addEventListener('click', function (e) {
    // FIXME, browser will only save 10 files at a time
    // for (let i = 0; i < chordDataArray.length; i += 10) {
    //
    // }
    saveFiles(0);
});

function saveFiles(startIndex) {
    for (let i = startIndex; i < Math.min(chordDataArray.length, startIndex + 10); i++) {
        let data = chordDataArray[i];
        const svg = data.svg;
        saveSvg(svg.node(), data.name + '.svg');
    }
}

let colorScale = d3.scaleOrdinal([
    '#1f77b4', '#aec7e8', '#ff7f0e',
    '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd',
    '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f',
    '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5',
    '#393b79', '#5254a3', '#6b6ecf',
    '#9c9ede', '#637939', '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31',
    '#bd9e39', '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b',
    '#e7969c', '#7b4173', '#a55194', '#ce6dbd', '#de9ed6']);


function clearVis() {
    $('#vis').empty();

    chordDataArray = [];
    document.getElementById('input-wrapper').style.minHeight = '';
    animateBtn.disabled = false;
    saveBtn.disabled = false;
}

function loadFile(f) {
    let reader = new FileReader();
    reader.onload = function (event) {
        let contents = event.target.result;
        let tab = /\t/;
        let lines = contents.split('\n');
        let header = lines[0].split(tab);
        let rankIndex = header.indexOf('rank');
        let interactingPairIndex = header.indexOf('interacting_pair');
        let secretedIndex = header.indexOf('secreted');
        let integrinIndex = header.indexOf('is_integrin');
        let isCellPhoneDbInput = rankIndex !== -1;

        let fileName = f.name;
        if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
            fileName = fileName.substring(0, fileName.length - 4);
        }
        let matrix = [];
        let names = [];
        let clusterNameToIndex = {};
        let numberOfClusters = 0;
        let clusterNames = [];
        let items = [];
        if (isCellPhoneDbInput) {
            // header names are pairs of clusters separated by |

            for (let j = rankIndex + 1; j < header.length; j++) {
                let names = header[j].split('|');
                clusterNames.push(names);
                names.forEach(name => {
                    let existingIndex = clusterNameToIndex[name];
                    if (existingIndex === undefined) {
                        clusterNameToIndex[name] = numberOfClusters;
                        numberOfClusters++;
                    }
                });
            }

            for (let name in clusterNameToIndex) {
                names[clusterNameToIndex[name]] = name;
            }
            for (let i = 0; i < numberOfClusters; i++) {
                matrix.push(new Float32Array(numberOfClusters));
            }


            for (let i = 1; i < lines.length; i++) {
                let line = lines[i];
                if (line === '') {
                    continue;
                }
                let tokens = line.split(tab);
                let pair = tokens[interactingPairIndex];
                let rank = parseFloat(tokens[rankIndex]);

                // let result = {
                //     name: datum.name,
                //     interacting_pair: pair,
                //     rank: rank,
                //     is_integrin: tokens[integrinIndex] === 'True',
                //     secreted: tokens[secretedIndex] === 'True',
                //     // clustersArray: []
                // };
                //let clusterArray = [];
                for (let j = 0; j < clusterNames.length; j++) {
                    let value = parseFloat(tokens[j + rankIndex + 1]);
                    let clusters = clusterNames[j];
                    if (!isNaN(value)) {
                        let partnerOneCluster = clusters[0];
                        let partnerTwoCluster = clusters[1];
                        let partnerOneIndex = clusterNameToIndex[partnerOneCluster];
                        let partnerTwoIndex = clusterNameToIndex[partnerTwoCluster];
                        matrix[partnerOneIndex][partnerTwoIndex] += 1;
                        let result = {
                            name: fileName,
                            interacting_pair: pair,
                            rank: rank,
                            is_integrin: tokens[integrinIndex] === 'True',
                            secreted: tokens[secretedIndex] === 'True',
                            clusters: clusters.join('_'),
                            _clusters: clusters
                        };
                        items.push(result);
                        // clusterArray.push(clusters.join('_'));
                        // result.clustersArray.push(clusters);
                    }
                }
                // if (clusterArray.length > 0) {
                //     result.clusters = clusterArray.join(', ');
                //     items.push(result);
                // }
            }
        } else {
            // // tsv of ligand_cluster, receptor_cluster, ligand, receptor 
            let ligandClusterIndex = header.indexOf('ligand_cluster');
            let receptorClusterIndex = header.indexOf('receptor_cluster');
            let ligandIndex = header.indexOf('ligand');
            let receptorIndex = header.indexOf('receptor');
            let array = [];
            for (let i = 1; i < lines.length; i++) {
                let line = lines[i];
                if (line === '') {
                    continue;
                }


                let tokens = line.split(tab);
                let ligandClusterName = tokens[ligandClusterIndex];
                if (ligandClusterName === '') {
                    continue;
                }
                array.push(tokens);
                let receptorClusterName = tokens[receptorClusterIndex];
                let existingIndex = clusterNameToIndex[ligandClusterName];
                if (existingIndex === undefined) {
                    clusterNameToIndex[ligandClusterName] = numberOfClusters;
                    numberOfClusters++;
                }
                existingIndex = clusterNameToIndex[receptorClusterName];
                if (existingIndex === undefined) {
                    clusterNameToIndex[receptorClusterName] = numberOfClusters;
                    numberOfClusters++;
                }
            }

            for (let name in clusterNameToIndex) {
                names[clusterNameToIndex[name]] = name;
            }
            for (let i = 0; i < numberOfClusters; i++) {
                matrix.push(new Float32Array(numberOfClusters));
            }


            for (let i = 0; i < array.length; i++) {
                let tokens = array[i];
                let ligand = tokens[ligandIndex];
                let receptor = tokens[receptorIndex];
                let ligandCluster = tokens[ligandClusterIndex];
                let receptorCluster = tokens[receptorClusterIndex];
                let partnerOneIndex = clusterNameToIndex[ligandCluster];
                let partnerTwoIndex = clusterNameToIndex[receptorCluster];

                matrix[partnerOneIndex][partnerTwoIndex] += 1;
                let result = {
                    name: fileName,
                    interacting_pair: [ligand, receptor].join('_'),
                    clusters: [ligandCluster, receptorCluster].join('_')
                };
                items.push(result);

            }
        }

        let datum = {
            names: names,
            matrix: matrix,
            items: items,
            prefix: 'chord-' + counter,
            name: fileName,
            animationIndex: 0
        };
        counter++;
        chordDataArray.push(datum);

        let $div = $('<div></div>');
        $div.appendTo($('#vis'));
        $('<h4>' + datum.name + '</h4>').appendTo($div);
        let $chord = $('<div class="chord"></div>');

        $chord.appendTo($div);

        createChordDiagram($chord[0], datum);


        if (table == null) {
            let $table = $('<table class="display" width="100%"></table>');
            $table.appendTo($div);
            table = $table.DataTable({
                "data": items,
                destroy: true,
                scroller: true,
                scrollY: 500,
                dom: 'Bfrtip',
                // // select: 'multi',
                buttons: [
                    'csv',
                ],
                "order": [[1, "asc"]],
                "columns": isCellPhoneDbInput ? [
                    {"data": "interacting_pair", title: 'interacting_pair'},
                    {"data": "rank", title: 'rank'},
                    {"data": "secreted", title: 'secreted'},
                    {"data": "is_integrin", title: 'integrin'},
                    {"data": "clusters", title: 'clusters'},
                    {"data": "name", title: 'name'}
                ] : [
                    {"data": "interacting_pair", title: 'interacting_pair'},
                    {"data": "clusters", title: 'clusters'},
                    {"data": "name", title: 'name'}
                ]
            });
        } else {
            table.rows.add(items);
            table.rows().invalidate().draw();
        }
        // table
        //     .on('select', function (e, dt, type, indexes) {
        //         let rowData = table.rows({selected: true}).data().toArray();
        //
        //     })
        //     .on('deselect', function (e, dt, type, indexes) {
        //         let rowData = table.rows(indexes).data().toArray();
        //     });
    };

    reader.onerror = function (event) {
        alert("Unable to read file.");
    };

    reader.readAsText(f);
}

let inputFile = document.getElementById("input_file");
inputFile.addEventListener("change", function (event) {
    clearVis();
    for (let i = 0; i < inputFile.files.length; i++) {
        loadFile(inputFile.files[i]);
    }
}, false);


window.addEventListener('drop', function (event) {
    document.body.style.border = '';
    event.preventDefault();
    event.stopPropagation();
    let dt = event.dataTransfer;
    let files = dt.files;
    clearVis();
    for (let i = 0; i < files.length; i++) {
        loadFile(files[i]);
    }
}, false);
window.addEventListener('dragover', function (event) {
    document.body.style.border = '2px solid black';
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}, false);
window.addEventListener('dragend', function (event) {
    document.body.style.border = '';

}, false);


function saveSvg(svgEl, name) {
    svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    let svgData = svgEl.outerHTML;
    let preface = '<?xml version="1.0" standalone="no"?>';
    let blob = new Blob([preface, svgData], {type: "image/svg+xml;charset=utf-8"});
    let svgUrl = URL.createObjectURL(blob);
    let downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = name;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}


function getInteractionTable(data, html, sourceIndex, targetIndex, name) {
    let clusterNameOne = data.names[sourceIndex];
    let clusterNameTwo = data.names[targetIndex];
    html.push('<table>');
    html.push('<tr><th>interacting_pair</th><th>rank</th><th>clusters</th></tr>');
    for (let i = 0; i < data.items.length; i++) {
        let item = data.items[i];
        if (item.name !== name) {
            continue;
        }
        if ((item._clusters[0] === clusterNameOne && item._clusters[1] === clusterNameTwo)
            || (item._clusters[0] === clusterNameTwo && item._clusters[1] === clusterNameOne)) {
            html.push('<tr>');
            html.push('<td>');
            html.push(item.interacting_pair);
            html.push('</td>');
            html.push('<td>');
            html.push(item.rank);
            html.push('</td>');
            html.push('<td style="max-width: 200px;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;">');
            html.push(item.clusters);
            html.push('</td>');
            html.push('</tr>');
        }


    }
    html.push('</table>');
}


// function updateChordOpacity() {
//     svg.selectAll(".chord path")
//         .transition()
//         .style("opacity", d => {
//             return (indices.has(d.source.index) || indices.has(d.target.index)) ? opacity : fadedOpacity;
//         });
//     svg.selectAll(".arc path")
//         .transition()
//         .style("opacity", d => {
//             return indices.has(d.index) ? opacity : fadedOpacity;
//         });
// }


function fadeChord(data, opacity, isSelected) {
    const svg = data.svg;
    
    return function (g, i) {
        if (isSelected) {
            let html = [];
            getInteractionTable(data, html, g.source.index, g.target.index, data.name);
            tooltip.html(html.join(''))
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        } else {
            tooltip.html('');
        }

        svg.selectAll(".chord > path")
            .filter(function (d, j) {
                return j != i;
            })
            .transition()
            .style("opacity", opacity);
        svg.selectAll("text")
            .filter(function (d) {
                return !(d.index == g.source.index || d.index == g.target.index);
            })
            .transition()
            .style("opacity", opacity);
        svg.selectAll(".arc path")
            .filter(function (d) {
                return !(d.index == g.source.index || d.index == g.target.index);
            })
            .transition()
            .style("opacity", opacity);

    };
}


function animateChords() {
    chordDataArray.forEach(data => {
        const svg = data.svg;
        if (animating) {
            svg.selectAll(".arc path")
                .style("opacity", d => (d.index == data.animationIndex) ? opacity : fadedOpacity);
            svg.selectAll(".chord > path")
                .style("opacity", d => d.source.index !== data.animationIndex && d.target.index != data.animationIndex ? fadedOpacity : opacity);
            svg.selectAll("text")
                .style("opacity", d => (d.index === data.animationIndex || data.matrix[data.animationIndex][d.index] > 0) ? opacity : fadedOpacity);

            data.animationIndex++;
            if (data.animationIndex >= data.matrix.length) {
                data.animationIndex = 0;
            }
        }
        window.setTimeout(animateChords, 400);
    });


}


function createChordDiagram(elementSelector, data) {

    const chord = d3.chord()
        .padAngle(.03)
        .sortSubgroups(d3.descending)
        .sortChords(d3.descending);

    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

    const ribbon = d3.ribbon()
        .radius(innerRadius);
    const chords = chord(data.matrix);

    const root = d3.select(elementSelector).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    data.svg = root;
    const svg = root
        .append("g")
        .attr("transform", "translate(" + (width / 2 + margin.left) + "," + (height / 2 + margin.top) + ")");

    //Create a gradient definition for each chord
    const grads = svg.append("defs").selectAll("linearGradient")
        .data(chords)
        .enter().append("linearGradient")
        //Create a unique gradient id per chord: e.g. "chordGradient-0-4"
        .attr("id", function (d) {
            return data.prefix + d.source.index + "-" + d.target.index;
        })
        .attr("gradientUnits", "userSpaceOnUse")
        //The full mathematical formula to find the x and y locations
        .attr("x1", function (d, i) {
            return innerRadius * Math.cos((d.source.endAngle - d.source.startAngle) / 2 +
                d.source.startAngle - Math.PI / 2);
        })
        .attr("y1", function (d, i) {
            return innerRadius * Math.sin((d.source.endAngle - d.source.startAngle) / 2 +
                d.source.startAngle - Math.PI / 2);
        })

        .attr("x2", function (d, i) {
            return innerRadius * Math.cos((d.target.endAngle - d.target.startAngle) / 2 +
                d.target.startAngle - Math.PI / 2);
        })
        .attr("y2", function (d, i) {
            return innerRadius * Math.sin((d.target.endAngle - d.target.startAngle) / 2 +
                d.target.startAngle - Math.PI / 2);
        });
    grads.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", function (d) {
            return colorScale(d.source.index);
        });
    grads.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", function (d) {
            return colorScale(d.target.index);
        });

    // arc is outer circle
    const group = svg.append("g").attr('class', 'arc')
        .selectAll("g")
        .data(chords.groups)
        .join("g");

    group.append("path")
        .attr("class", "outer")
        .attr("fill", d => colorScale(d.index))
        .attr("opacity", opacity)
        .attr("stroke", d => colorScale(d.index))
        .attr("d", arc);


    group.append("text")
        .each(function (d) {
            d.angle = (d.startAngle + d.endAngle) / 2;
        })
        .attr("dy", ".35em")
        .attr("class", "titles")
        .attr("text-anchor", function (d) {
            return d.angle > Math.PI ? "end" : null;
        })
        .attr("transform", function (d) {
            return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
                + "translate(" + (outerRadius + 3) + ")"
                + (d.angle > Math.PI ? "rotate(180)" : "");
        })
        .text(function (d, i) {
            return data.names[i];
        });


    // .chord show connections
    svg.append("g").attr("class", "chord")
        .selectAll("path")
        .data(chords)
        .join("path")
        .style("fill", function (d) {
            return "url(#" + data.prefix + d.source.index + "-" + d.target.index + ")";
        })
        // .attr("stroke", d => d3.rgb(colorScale(data.names[d.source.index])).darker())
        // .attr("fill", d => colorScale(data.names[d.source.index]))
        .attr("opacity", opacity)
        .attr("d", ribbon).on("mouseover", fadeChord(data, fadedOpacity, true))
        .on("mouseout", fadeChord(data, opacity, false));

}