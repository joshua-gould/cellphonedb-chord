let animateBtn = document.getElementById('animate');
let tooltip = d3.select('#tooltip');
let saveBtn = document.getElementById('save');
let svg = null;
let margin = {left: 150, top: 150, right: 150, bottom: 150};
let width = Math.min(window.innerWidth, 750) - margin.left - margin.right;
let height = Math.min(window.innerWidth, 750) - margin.top - margin.bottom;
let innerRadius = Math.min(width, height) * .55;
let outerRadius = innerRadius + 6;
let table = null;
let data = {matrix: [], names: []};
let dataArray = null;
let animating = false;
let opacity = 0.7;
let fadedOpacity = 0.1;

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
    saveSvg(svg.node(), 'chord.svg');
});

let colorScale = d3.scaleOrdinal([
    '#1f77b4', '#aec7e8', '#ff7f0e',
    '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd',
    '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f',
    '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5',
    '#393b79', '#5254a3', '#6b6ecf',
    '#9c9ede', '#637939', '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31',
    '#bd9e39', '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b',
    '#e7969c', '#7b4173', '#a55194', '#ce6dbd', '#de9ed6']);


function loadFile(f) {
    document.getElementById('chord').innerHTML = '';
    document.getElementById('input-wrapper').style.minHeight = '';
    animateBtn.disabled = false;
    saveBtn.disabled = false;
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
        if (rankIndex === -1 || interactingPairIndex === -1 || secretedIndex === -1 || integrinIndex === -1) {
            throw 'Error parsing file';
        }

        // header names are pairs of clusters separated by |
        let nameToIndex = {};
        let numberOfClusters = 0;
        let clusterNames = [];
        for (let j = rankIndex + 1; j < header.length; j++) {
            let names = header[j].split('|');
            clusterNames.push(names);
            names.forEach(name => {
                let existingIndex = nameToIndex[name];
                if (existingIndex === undefined) {
                    nameToIndex[name] = numberOfClusters;
                    numberOfClusters++;
                }
            });
        }
        let matrix = [];
        let names = [];
        for (let name in nameToIndex) {
            names[nameToIndex[name]] = name;
        }
        for (let i = 0; i < numberOfClusters; i++) {
            matrix.push(new Float32Array(numberOfClusters));
        }


        data.names = names;
        data.matrix = matrix; // name by name matrix

        dataArray = [];

        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            if (line === '') {
                continue;
            }
            let tokens = line.split(tab);
            let pair = tokens[interactingPairIndex];
            let rank = parseFloat(tokens[rankIndex]);

            let result = {
                interacting_pair: pair,
                rank: rank,
                is_integrin: tokens[integrinIndex] === 'True',
                secreted: tokens[secretedIndex] === 'True',
                clustersArray: []
            };
            let clusterArray = [];
            for (let j = 0; j < clusterNames.length; j++) {
                let value = parseFloat(tokens[j + rankIndex + 1]);
                let clusters = clusterNames[j];
                if (!isNaN(value)) {
                    let partnerOneCluster = clusters[0];
                    let partnerTwoCluster = clusters[1];
                    let partnerOneIndex = nameToIndex[partnerOneCluster];
                    let partnerTwoIndex = nameToIndex[partnerTwoCluster];
                    matrix[partnerOneIndex][partnerTwoIndex] += 1;
                    clusterArray.push(clusters.join('_'));
                    result.clustersArray.push(clusters);
                }
            }
            if (clusterArray.length > 0) {
                result.clusters = clusterArray.join(', ');
                dataArray.push(result);
            }
        }


        createChordDiagram();
        $('#details').dataTable({
            "data": dataArray,
            destroy: true,
            scroller: true,
            scrollY: 500,
            "order": [[1, "asc"]],
            "columns": [
                {"data": "interacting_pair", title: 'interacting_pair'},
                {"data": "rank", title: 'rank'},
                {"data": "secreted", title: 'secreted'},
                {"data": "is_integrin", title: 'integrin'},
                {"data": "clusters", title: 'clusters'}
            ]
        });
    };

    reader.onerror = function (event) {
        alert("Unable to read file.");
    };

    reader.readAsText(f);
}

let inputFile = document.getElementById("input_file");
inputFile.addEventListener("change", function (event) {
    loadFile(inputFile.files[0]);
}, false);


window.addEventListener('drop', function (event) {
    document.body.style.border = '';
    event.preventDefault();
    event.stopPropagation();
    let dt = event.dataTransfer;
    let files = dt.files;
    loadFile(files[0]);
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
    let preface = '<?xml version="1.0" standalone="no"?>\r\n';
    let svgBlob = new Blob([preface, svgData], {type: "image/svg+xml;charset=utf-8"});
    let svgUrl = URL.createObjectURL(svgBlob);
    let downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = name;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}


function fade(opacity) {
    return function (g, i) {
        svg.selectAll(".chord path")
            .filter(function (d) {
                return d.source.index != i && d.target.index != i;
            })
            .transition()
            .style("opacity", opacity);
    };
}


function getInteractionTable(html, sourceIndex, targetIndex) {
    let clusterNameOne = data.names[sourceIndex];
    let clusterNameTwo = data.names[targetIndex];
    html.push('<table>');
    html.push('<tr><th>interacting_pair</th><th>rank</th><th>clusters</th></tr>');
    for (let i = 0; i < dataArray.length; i++) {
        let result = dataArray[i];
        let found = false;
        for (let j = 0; j < result.clustersArray.length; j++) {
            if ((result.clustersArray[j][0] === clusterNameOne && result.clustersArray[j][1] === clusterNameTwo)
                || (result.clustersArray[j][0] === clusterNameTwo && result.clustersArray[j][1] === clusterNameOne)) {
                found = true;
                break;
            }
        }
        if (found) {
            html.push('<tr>');
            html.push('<td>');
            html.push(result.interacting_pair);
            html.push('</td>');
            html.push('<td>');
            html.push(result.rank);
            html.push('</td>');
            html.push('<td style="max-width: 200px;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;">');
            html.push(result.clusters);
            html.push('</td>');
            html.push('</tr>');
        }
    }
    html.push('</table>');
}

function fadeChord(opacityArcs, opacityChords, isSelected) {
    return function (g, i) {
        if (isSelected) {
            let html = [];
            getInteractionTable(html, g.source.index, g.target.index);

            tooltip.html(html.join(''))
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        } else {
            tooltip.html('');
        }
        svg.selectAll(".chord path")
            .filter(function (d, j) {
                return j != i;
            })
            .transition()
            .style("opacity", opacityChords);
        svg.selectAll(".arc path")
            .filter(function (d) {
                return !(d.index == g.source.index || d.index == g.target.index);
            })
            .transition()
            .style("opacity", opacityArcs);

    };
}

let animationIndex = 0;

function animateChords() {
    if (animating) {
        svg.selectAll(".arc path")
            .style("opacity", d => (d.index == animationIndex) ? opacity : fadedOpacity);
        svg.selectAll(".chord path")
            .style("opacity", d => d.source.index !== animationIndex && d.target.index != animationIndex ? fadedOpacity : opacity);
        svg.selectAll("text")
            .style("opacity", d => (d.index === animationIndex || data.matrix[animationIndex][d.index] > 0) ? opacity : fadedOpacity);

        animationIndex++;
        if (animationIndex >= data.matrix.length) {
            animationIndex = 0;
        }
        window.setTimeout(animateChords, 400);
    }

}

function stopAnimation() {
    animating = false;
    svg.selectAll(".arc path")
        .style("opacity", opacity);
    svg.selectAll(".chord path")
        .style("opacity", opacity);
    svg.selectAll("text")
        .style("opacity", opacity);
}


function createChordDiagram() {

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

    svg = d3.select("#chord").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + (width / 2 + margin.left) + "," + (height / 2 + margin.top) + ")");
    //Create a gradient definition for each chord
    var grads = svg.append("defs").selectAll("linearGradient")
        .data(chords)
        .enter().append("linearGradient")
        //Create a unique gradient id per chord: e.g. "chordGradient-0-4"
        .attr("id", function (d) {
            return "chordGradient-" + d.source.index + "-" + d.target.index;
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

    let group = svg.append("g").attr('class', 'arc')
        .selectAll("g")
        .data(chords.groups)
        .join("g");

    group.append("path")
        .attr("class", "outer")
        .attr("fill", d => colorScale(d.index))
        .attr("opacity", opacity)
        .attr("stroke", d => colorScale(d.index))
        .attr("d", arc).on("mouseover", fade(.1))
        .on("mouseout", fade(opacity));


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


    svg.append("g").attr("class", "chord")
        .selectAll("path")
        .data(chords)
        .join("path")
        .style("fill", function (d) {
            return "url(#chordGradient-" + d.source.index + "-" + d.target.index + ")";
        })
        // .attr("stroke", d => d3.rgb(colorScale(data.names[d.source.index])).darker())
        // .attr("fill", d => colorScale(data.names[d.source.index]))
        .attr("opacity", opacity)
        .attr("d", ribbon)
        .on("mouseover", fadeChord(fadedOpacity, fadedOpacity, true))
        .on("mouseout", fadeChord(opacity, opacity, false));

}