let animateBtn = document.getElementById('animate');
let tooltip = d3.select('#tooltip');
let saveBtn = document.getElementById('save');
let svg = null;
let width = 450;
let height = width;
let data = {matrix: [], names: []};
let animating = false;

function startAnimation() {
    animating = true;
    window.setTimeout(animateChords, 200);
}


animateBtn.addEventListener('click', function (e) {
    if (animating) {
        animateBtn.innerText = 'Play';
        stopAnimation();
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
let opacity = 0.7;

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
        // header names are pairs of clusters separated by |
        let nameToIndex = {};
        let numberOfClusters = 0;
        let headerNames = [];
        for (let j = rankIndex + 1; j < header.length; j++) {
            let names = header[j].split('|');
            headerNames.push(names);
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
        let rowAndColumns = [];

        for (let i = 0; i < headerNames.length; i++) {
            let headerName = headerNames[i];
            let row = nameToIndex[headerName[0]];
            let column = nameToIndex[headerName[1]];
            rowAndColumns.push([row, column]);
        }

        data.names = names;
        data.matrix = matrix; // name by name matrix

        let fullMatrix = []; // ligand gene + ligand cluster on rows, receptor gene + receptor cluster on columns
        let rowToIndex = new Map();
        let columnToIndex = new Map();
        let maxValue = -Number.MAX_VALUE;
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            let tokens = line.split(tab);
            let pair = tokens[interactingPairIndex];
            for (let j = 0; j < headerNames.length; j++) {
                let value = parseFloat(tokens[j + rankIndex + 1]);

                if (!isNaN(value) && value > 0) {
                    let ligandAndReceptor = pair.split('_');
                    let ligand = ligandAndReceptor[0];
                    let receptor = ligandAndReceptor[1];

                    let rowAndColumn = rowAndColumns[j];
                    let row = rowAndColumn[0];
                    let column = rowAndColumn[1];
                    let ligandCluster = names[row];
                    let receptorCluster = names[column];

                    matrix[row][column] += 1;
                    let rowKey = ligand + ',' + ligandCluster;
                    let columnKey = receptor + ',' + receptorCluster;
                    let rowIndex = rowToIndex.get(rowKey);
                    if (rowIndex === undefined) {
                        rowIndex = rowToIndex.size;
                        rowToIndex.set(rowKey, rowIndex);
                    }
                    let columnIndex = columnToIndex.get(columnKey);
                    if (columnIndex === undefined) {
                        columnIndex = columnToIndex.size;
                        columnToIndex.set(columnKey, columnIndex);
                    }
                    let matrixRow = fullMatrix[rowIndex];
                    if (matrixRow === undefined) {
                        matrixRow = {};
                        fullMatrix[rowIndex] = matrixRow;
                    }
                    matrixRow[columnIndex] = value;
                    maxValue = Math.max(maxValue, value);
                    //matrix[row][column] += value;
                }
            }
        }
        let dataset = new morpheus.Dataset({
            name: '',
            rows: fullMatrix.length,
            columns: columnToIndex.size,
            array: fullMatrix,
            dataType: 'Float32'
        });


        let ligandVector = dataset.getRowMetadata().add('ligand');
        let ligandClusterVector = dataset.getRowMetadata().add('cluster');
        for (let [key, index] of rowToIndex) {
            key = key.split(',');
            ligandVector.setValue(index, key[0]);
            ligandClusterVector.setValue(index, key[1]);
        }
        let receptorVector = dataset.getColumnMetadata().add('receptor');
        let receptorClusterVector = dataset.getColumnMetadata().add('cluster');
        for (let [key, index] of columnToIndex) {
            key = key.split(',');
            receptorVector.setValue(index, key[0]);
            receptorClusterVector.setValue(index, key[1]);
        }
        let ligandClusterToRowIndices = morpheus.VectorUtil.createValueToIndicesMap(ligandClusterVector);
        let receptorClusterToRowIndices = morpheus.VectorUtil.createValueToIndicesMap(receptorClusterVector);
        data.dataset = dataset;
        data.ligandClusterToRowIndices = ligandClusterToRowIndices;
        data.receptorClusterToRowIndices = receptorClusterToRowIndices;

        let ligandToRowIndices = morpheus.VectorUtil.createValueToIndicesMap(ligandVector);
        let numSignificantVector = dataset.getRowMetadata().add('# significant per gene');
        ligandToRowIndices.forEach((rowIndices, ligand) => {
            let slicedDataset = new morpheus.SlicedDatasetView(dataset, rowIndices, null);
            let count = 0;
            for (let i = 0; i < slicedDataset.getRowCount(); i++) {
                for (let j = 0; j < slicedDataset.getColumnCount(); j++) {
                    if (!isNaN(slicedDataset.getValue(i, j))) {
                        count++;
                    }
                }
            }

            for (let i = 0; i < rowIndices.length; i++) {
                numSignificantVector.setValue(rowIndices[i], count);
            }
        });
        new morpheus.HeatMap({
            dataset: dataset,
            el: '#heatmap',
            height: 500,
            menu: false,
            autohideTabBar: true,
            closeable: false,
            colorScheme: {
                scalingMode: 'fixed',
                stepped: false,
                values: [0, Math.ceil(maxValue)],
                colors: ['white', 'red']
            },
            renderReady: function (heatmap) {
                let colorModel = heatmap.project.getRowColorModel();
                heatmap.project.columnColorModel = heatmap.project.getRowColorModel();
                data.names.forEach(name => {
                    let c = colorScale(name);
                    colorModel.setMappedValue(ligandClusterVector, name, c);
                });
            },

            rowSortBy: [
                {
                    field: 'cluster',
                    type: 'annotation',
                    order: 0
                },
                {
                    field: 'ligand',
                    type: 'annotation',
                    order: 0,
                }],

            columnSortBy: [
                {
                    field: 'cluster',
                    type: 'annotation',
                    order: 0
                }, {
                    field: 'receptor',
                    type: 'annotation',
                    order: 0,

                }],
            rows: [
                {
                    field: 'cluster',
                    display: ['text', 'color'],
                    highlightMatchingValues: true
                }, {
                    field: 'ligand',
                    display: ['text'],
                    highlightMatchingValues: true
                }, {
                    field: numSignificantVector.getName(),
                    display: ['text'],
                    formatter: '.0f'
                }],
            columns: [
                {
                    field: 'receptor',
                    display: ['text'],
                    highlightMatchingValues: true
                }, {
                    field: 'cluster',
                    display: ['color'],
                    highlightMatchingValues: true
                }],
        });

        createChordDiagram();
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


function fadeChord(opacityArcs, opacityChords, isSelected) {
    return function (g, i) {
        if (isSelected) {
            let ligandCluster = data.names[g.source.index];
            let receptorCluster = data.names[g.target.index];
            let dataset = data.dataset;
            let rowIndices = data.ligandClusterToRowIndices.get(ligandCluster);
            let columnIndices = data.receptorClusterToRowIndices.get(receptorCluster);
            let ligandVector = dataset.getRowMetadata().getByName('ligand');
            let receptorVector = dataset.getColumnMetadata().getByName('receptor');
            let html = ['<table>'];
            html.push('<tr>');
            html.push('<th>');
            html.push('Ligand<br/>' + ligandCluster);
            html.push('</th>');
            html.push('<th>');
            html.push('Receptor<br/>' + receptorCluster);
            html.push('</th>');
            html.push('<th></th>');
            html.push('</tr>');
            let count = 0;
            for (let i = 0; i < rowIndices.length; i++) {
                for (let j = 0; j < columnIndices.length; j++) {
                    let value = dataset.getValue(rowIndices[i], columnIndices[j]);
                    if (!isNaN(value)) {
                        count++;
                        html.push('<tr>');
                        html.push('<td>');
                        html.push(ligandVector.getValue(rowIndices[i]));
                        html.push('</td>');
                        html.push('<td>');
                        html.push(receptorVector.getValue(columnIndices[j]));
                        html.push('</td>');
                        html.push('<td>');
                        html.push(value);
                        html.push('</td>');
                        html.push('</tr>');
                    }
                }
            }
            html.push('</table>');

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
            .style("opacity", d => (d.index == animationIndex) ? 0.7 : 0.1);
        svg.selectAll(".chord path")
            .style("opacity", d => d.source.index !== animationIndex && d.target.index != animationIndex ? 0.1 : 0.7);
        svg.selectAll("text")
            .style("opacity", d => (d.index == animationIndex || data.matrix[animationIndex][d.index] > 0) ? 0.7 : 0.1);

        animationIndex++;
        if (animationIndex < data.matrix.length) {
            window.setTimeout(animateChords, 400);
        }
    } else {
        stopAnimation();
    }


}

function stopAnimation() {
    animating = false;
    svg.selectAll(".arc path")
        .style("opacity", 1);
    svg.selectAll(".chord path")
        .style("opacity", 1);
    svg.selectAll("text")
        .style("opacity", 1);
}


function createChordDiagram() {
    let outerRadius = Math.min(width, height) * 0.46;
    let innerRadius = outerRadius - 120;
    let chord = d3.chord()
        .padAngle(.03)
        .sortSubgroups(d3.descending)
        .sortChords(d3.descending);

    let arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(innerRadius + 2);
    // let outerArc = d3.arc()
    //     .innerRadius(innerRadius + 3)
    //     .outerRadius(innerRadius + 6);

    let ribbon = d3.ribbon()
        .radius(innerRadius);

    svg = d3.select(document.getElementById('chord')).append("svg")
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .style("width", "100%")
        .style("height", "auto");
    const chords = chord(data.matrix);
    svg.append("g")
        .selectAll("g")
        .data(chords.groups)
        .join("g");

    // group.append("path")
    //     .attr("fill", d => colorScale(data.names[d.index]))
    //     .attr("stroke", d => colorScale(data.names[d.index])).attr('d', outerArc);

    group = svg.append("g").attr('class', 'arc')
        .selectAll("g")
        .data(chords.groups)
        .join("g");

    group.append("path")
        .attr("fill", d => colorScale(data.names[d.index]))
        .attr("opacity", opacity)
        .attr("stroke", d => colorScale(data.names[d.index]))
        .attr("d", arc).on("mouseover", fade(.1))
        .on("mouseout", fade(1));


    group.append("text")
        .each(d => {
            d.angle = (d.startAngle + d.endAngle) / 2;
        })
        .attr("dy", ".35em")
        .attr("transform", d => `
        rotate(${(d.angle * 180 / Math.PI - 90)})
        translate(${innerRadius + 4})
        ${d.angle > Math.PI ? "rotate(180)" : ""}
      `)
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
        .text(d => data.names[d.index]);

    svg.append("g").attr("class", "chord")
        .selectAll("path")
        .data(chords)
        .join("path")
        .attr("stroke", d => d3.rgb(colorScale(data.names[d.source.index])).darker())
        .attr("fill", d => colorScale(data.names[d.source.index]))
        .attr("opacity", opacity)
        .attr("d", ribbon)
        .on("mouseover", fadeChord(0.1, 0.1, true))
        .on("mouseout", fadeChord(1, 1, false));

}