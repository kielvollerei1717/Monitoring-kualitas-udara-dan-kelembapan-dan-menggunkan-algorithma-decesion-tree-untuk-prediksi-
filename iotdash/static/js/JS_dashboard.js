let tempGauge, humidityGauge, airGauge;
let tempGaugeData, humidityGaugeData, airGaugeData;

let lineChart;
let airChart;
let minuteLineChartData = [['Waktu (Per Menit)', 'Rata-rata Temperatur (°C)', 'Rata-rata Kelembapan (%)']];
let minuteAirChartData = [['Waktu (Per Menit)', 'Rata-rata Kualitas Udara (PPM)']];
const MAX_MINUTE_POINTS = 90;

let currentMinuteAccumulator = {
    minuteLabel: null,
    sumTemp: 0,
    sumHum: 0,
    sumAir: 0,
    count: 0,
};

// Global variables for unified dashboard elements
let dashboardElements = {
    tempStatus: null,
    humStatus: null,
    airStatus: null,
    lastUpdate: null,
    connectionStatus: null
};

const GAUGE_CHART_ACTUAL_HEIGHT = 170;
const commonGaugeOptions = {
    width: '100%',
    height: GAUGE_CHART_ACTUAL_HEIGHT,
    minorTicks: 10,
    majorTicks: ['0', '25', '50', '75', '100'],
    animation: { 
        duration: 600, 
        easing: 'inAndOut' 
    },
    // Modern Blynk-style gauge options
    redColor: '#FF6B6B',
    yellowColor: '#FFD93D',
    greenColor: '#6BCF7F',
    // Enhanced visual styling
    forceIFrame: false,
    backgroundColor: 'transparent',
    // Gauge styling for modern look
    needle: {
        color: '#2c3e50',
        width: 3
    },
    bands: [
        { from: 0, to: 100, color: 'rgba(255, 255, 255, 0.05)' }
    ]
};
const tempOptions = { 
    ...commonGaugeOptions, 
    redFrom: 35, redTo: 50, 
    yellowFrom: 27, yellowTo: 34, 
    greenFrom: 18, greenTo: 26, 
    min: 0, max: 50,
    majorTicks: ['0', '10', '20', '30', '40', '50']
};
const humidityOptions = { 
    ...commonGaugeOptions, 
    redFrom: 71, redTo: 100, 
    yellowFrom: 61, yellowTo: 70, 
    greenFrom: 30, greenTo: 60, 
    min: 0, max: 100,
    majorTicks: ['0', '20', '40', '60', '80', '100']
};
const airOptions = { 
    ...commonGaugeOptions, 
    redFrom: 301, redTo: 500, 
    yellowFrom: 151, yellowTo: 300, 
    greenFrom: 0, greenTo: 150, 
    min: 0, max: 500,
    majorTicks: ['0', '100', '200', '300', '400', '500']
};

const minuteLineChartOptions = {
    title: 'Grafik Temperatur & Kelembapan (Per Menit)',
    titleTextStyle: { 
        color: '#2c3e50', 
        fontSize: 16, 
        bold: true,
        fontName: 'Segoe UI'
    },
    curveType: 'function',
    legend: { 
        position: 'bottom', 
        textStyle: { 
            color: '#555', 
            fontSize: 12,
            fontName: 'Segoe UI'
        }
    },
    height: 350,
    chartArea: {width: '85%', height: '70%'},
    hAxis: { 
        title: 'Waktu (Menit)', 
        titleTextStyle: { color: '#555' }, 
        textStyle: { 
            color: '#555', 
            slantedText: true, 
            slantedTextAngle: 45,
            fontSize: 11
        },
        gridlines: { color: '#e0e0e0' },
        direction: 1, // Left to right expansion
        format: 'short'
    },
    vAxis: { 
        title: 'Nilai', 
        viewWindow: { min: 0 },
        titleTextStyle: { color: '#555' }, 
        textStyle: { color: '#555', fontSize: 11 },
        gridlines: { color: '#f5f5f5' }
    },
    series: { 
        0: { color: '#e74c3c', lineWidth: 2, pointSize: 3 }, 
        1: { color: '#3498db', lineWidth: 2, pointSize: 3 }
    },
    backgroundColor: '#ffffff',
    animation: { 
        startup: true, 
        duration: 1000, 
        easing: 'out' 
    },
    interpolateNulls: true,
    explorer: { 
        actions: ['dragToZoom', 'rightClickToReset'],
        axis: 'horizontal',
        keepInBounds: true,
        maxZoomIn: 4.0
    }
};

const minuteAirChartOptions = {
    title: 'Grafik Kualitas Udara (Per Menit)',
    titleTextStyle: { 
        color: '#2c3e50', 
        fontSize: 16, 
        bold: true,
        fontName: 'Segoe UI'
    },
    curveType: 'function',
    legend: { 
        position: 'bottom', 
        textStyle: { 
            color: '#555', 
            fontSize: 12,
            fontName: 'Segoe UI'
        }
    },
    height: 350,
    chartArea: {width: '85%', height: '70%'},
    hAxis: { 
        title: 'Waktu (Menit)', 
        titleTextStyle: { color: '#555' }, 
        textStyle: { 
            color: '#555', 
            slantedText: true, 
            slantedTextAngle: 45,
            fontSize: 11
        },
        gridlines: { color: '#e0e0e0' },
        direction: 1, // Left to right expansion
        format: 'short'
    },
    vAxis: { 
        title: 'PPM', 
        viewWindow: { min: 0 },
        titleTextStyle: { color: '#27ae60' }, 
        textStyle: { color: '#27ae60', fontSize: 11 },
        gridlines: { color: '#eafaf1' }
    },
    series: { 
        0: { color: '#27ae60', lineWidth: 2, pointSize: 3 }
    },
    backgroundColor: '#ffffff',
    animation: { 
        startup: true, 
        duration: 1000, 
        easing: 'out' 
    },
    interpolateNulls: true,
    explorer: { 
        actions: ['dragToZoom', 'rightClickToReset'],
        axis: 'horizontal',
        keepInBounds: true,
        maxZoomIn: 4.0
    }
};

// --- FUNGSI BARU UNTUK MENGATUR STATUS PREDIKSI ---
function updatePredictionStatus(temp, hum, aq) {
    const predTempStatusEl = document.getElementById('pred_temp_status');
    const predHumStatusEl = document.getElementById('pred_hum_status');
    const predAirStatusEl = document.getElementById('pred_air_status');

    // Standar SNI 6390:2011 - Temperature
    if (predTempStatusEl) {
        if (temp < 20.5) { 
            predTempStatusEl.textContent = 'Dingin'; 
            predTempStatusEl.className = 'status status-cold'; 
        }
        else if (temp >= 20.5 && temp <= 22.8) { 
            predTempStatusEl.textContent = 'Nyaman Sejuk'; 
            predTempStatusEl.className = 'status status-good'; 
        }
        else if (temp > 22.8 && temp <= 25.8) { 
            predTempStatusEl.textContent = 'Nyaman'; 
            predTempStatusEl.className = 'status status-good'; 
        }
        else if (temp > 25.8 && temp <= 27.1) { 
            predTempStatusEl.textContent = 'Nyaman Hangat'; 
            predTempStatusEl.className = 'status status-warm'; 
        }
        else { 
            predTempStatusEl.textContent = 'Panas'; 
            predTempStatusEl.className = 'status status-bad'; 
        }
    }

    // Standar SNI 6390:2011 - Humidity (adjusted for comfort zones)
    if (predHumStatusEl) {
        if (hum < 50) { 
            predHumStatusEl.textContent = 'Kering'; 
            predHumStatusEl.className = 'status status-dry'; 
        }
        else if (hum >= 50 && hum <= 60) { 
            predHumStatusEl.textContent = 'Ideal (Sejuk)'; 
            predHumStatusEl.className = 'status status-ideal'; 
        }
        else if (hum > 60 && hum <= 70) { 
            predHumStatusEl.textContent = 'Ideal (Hangat)'; 
            predHumStatusEl.className = 'status status-ideal'; 
        }
        else if (hum > 70 && hum <= 80) { 
            predHumStatusEl.textContent = 'Optimal'; 
            predHumStatusEl.className = 'status status-good'; 
        }
        else { 
            predHumStatusEl.textContent = 'Terlalu Lembap'; 
            predHumStatusEl.className = 'status status-too-humid'; 
        }
    }

    // Kualitas Udara (Based on MQ-135 research standards)
    if (predAirStatusEl) {
        if (aq >= 1 && aq <= 50) { 
            predAirStatusEl.textContent = 'Baik'; 
            predAirStatusEl.className = 'status status-good'; 
        }
        else if (aq >= 51 && aq <= 100) { 
            predAirStatusEl.textContent = 'Rata-rata'; 
            predAirStatusEl.className = 'status status-moderate'; 
        }
        else if (aq >= 101 && aq <= 200) { 
            predAirStatusEl.textContent = 'Tidak Sehat'; 
            predAirStatusEl.className = 'status status-bad'; 
        }
        else if (aq >= 201 && aq <= 300) { 
            predAirStatusEl.textContent = 'Sangat Tidak Sehat'; 
            predAirStatusEl.className = 'status status-bad'; 
        }
        else if (aq >= 301) { 
            predAirStatusEl.textContent = 'Berbahaya'; 
            predAirStatusEl.className = 'status status-bad'; 
        }
        else { 
            predAirStatusEl.textContent = 'Tidak Valid'; 
            predAirStatusEl.className = 'status status-bad'; 
        }
    }
}

// --- FUNGSI DASHBOARD TERPADU ---
// Initialize unified dashboard elements
function initDashboardElements() {
    dashboardElements = {
        tempStatus: document.getElementById('temp_status_text'),
        humStatus: document.getElementById('humidity_status_text'),
        airStatus: document.getElementById('air_quality_status_text'),
        lastUpdate: document.getElementById('lastUpdate'),
        connectionStatus: document.getElementById('connection_status')
    };
    console.log("Unified dashboard elements initialized");
}

// Update unified dashboard display (combines gauge and status only)
function updateDashboard(temp, hum, aq, timestamp) {
    console.log(`Updating unified dashboard: T=${temp}, H=${hum}, AQ=${aq}`);
    
    // Update status using existing gauge status logic
    updateUnifiedStatus(temp, hum, aq);
    
    // Update timestamp
    if (dashboardElements.lastUpdate) {
        const now = timestamp ? new Date(timestamp.replace(' ', 'T')) : new Date();
        const formattedTime = now.toLocaleString('id-ID', { 
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
        });
        dashboardElements.lastUpdate.textContent = formattedTime;
    }
    
    // Update connection status
    updateConnectionStatus(true);
}

// Update unified status indicators (uses SNI standards)
function updateUnifiedStatus(temp, hum, aq) {
    // Temperature status (SNI 6390:2011)
    if (dashboardElements.tempStatus && temp !== null && temp !== undefined) {
        if (temp < 20.5) {
            dashboardElements.tempStatus.textContent = 'Dingin';
            dashboardElements.tempStatus.className = 'sensor-status-text status-cold';
        }
        else if (temp >= 20.5 && temp <= 22.8) {
            dashboardElements.tempStatus.textContent = 'Nyaman Sejuk';
            dashboardElements.tempStatus.className = 'sensor-status-text status-good';
        }
        else if (temp > 22.8 && temp <= 25.8) {
            dashboardElements.tempStatus.textContent = 'Nyaman';
            dashboardElements.tempStatus.className = 'sensor-status-text status-good';
        }
        else if (temp > 25.8 && temp <= 27.1) {
            dashboardElements.tempStatus.textContent = 'Nyaman Hangat';
            dashboardElements.tempStatus.className = 'sensor-status-text status-warm';
        }
        else {
            dashboardElements.tempStatus.textContent = 'Panas';
            dashboardElements.tempStatus.className = 'sensor-status-text status-bad';
        }
    }

    // Humidity status (SNI 6390:2011)
    if (dashboardElements.humStatus && hum !== null && hum !== undefined) {
        if (hum < 50) {
            dashboardElements.humStatus.textContent = 'Kering';
            dashboardElements.humStatus.className = 'sensor-status-text status-dry';
        }
        else if (hum >= 50 && hum <= 60) {
            dashboardElements.humStatus.textContent = 'Ideal (Sejuk)';
            dashboardElements.humStatus.className = 'sensor-status-text status-ideal';
        }
        else if (hum > 60 && hum <= 70) {
            dashboardElements.humStatus.textContent = 'Ideal (Hangat)';
            dashboardElements.humStatus.className = 'sensor-status-text status-ideal';
        }
        else if (hum > 70 && hum <= 80) {
            dashboardElements.humStatus.textContent = 'Optimal';
            dashboardElements.humStatus.className = 'sensor-status-text status-good';
        }
        else {
            dashboardElements.humStatus.textContent = 'Terlalu Lembap';
            dashboardElements.humStatus.className = 'sensor-status-text status-too-humid';
        }
    }

    // Air quality status (Based on MQ-135 research standards)
    if (dashboardElements.airStatus && aq !== null && aq !== undefined) {
        if (aq >= 1 && aq <= 50) {
            dashboardElements.airStatus.textContent = 'Baik';
            dashboardElements.airStatus.className = 'sensor-status-text status-good';
        }
        else if (aq >= 51 && aq <= 100) {
            dashboardElements.airStatus.textContent = 'Rata-rata';
            dashboardElements.airStatus.className = 'sensor-status-text status-moderate';
        }
        else if (aq >= 101 && aq <= 200) {
            dashboardElements.airStatus.textContent = 'Tidak Sehat';
            dashboardElements.airStatus.className = 'sensor-status-text status-bad';
        }
        else if (aq >= 201 && aq <= 300) {
            dashboardElements.airStatus.textContent = 'Sangat Tidak Sehat';
            dashboardElements.airStatus.className = 'sensor-status-text status-bad';
        }
        else if (aq >= 301) {
            dashboardElements.airStatus.textContent = 'Berbahaya';
            dashboardElements.airStatus.className = 'sensor-status-text status-bad';
        }
        else {
            dashboardElements.airStatus.textContent = 'Tidak Valid';
            dashboardElements.airStatus.className = 'sensor-status-text status-bad';
        }
    }
}

// Update connection status
function updateConnectionStatus(isConnected) {
    if (dashboardElements.connectionStatus) {
        if (isConnected) {
            dashboardElements.connectionStatus.textContent = '🟢 Connected';
            dashboardElements.connectionStatus.className = 'connection-status connected';
        } else {
            dashboardElements.connectionStatus.textContent = '🔴 Disconnected';
            dashboardElements.connectionStatus.className = 'connection-status disconnected';
        }
    }
}


// --- MODIFIKASI FUNGSI getPrediction UNTUK TAMPILAN BARU ---
function getPrediction(temp, hum, aq) {
    console.log(`[${new Date().toLocaleTimeString()}] 🔍 Calling getPrediction() with: T=${temp}, H=${hum}, AQ=${aq}`);

    fetch("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature: temp, humidity: hum, air_quality: aq })
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(errData => { 
                throw new Error(`HTTP error ${res.status}: ${errData.error || 'Unknown error'}`);
            }).catch(() => { 
                throw new Error(`HTTP error ${res.status}: Unable to parse error details`);
            });
        }
        return res.json();
    })
    .then(prediction => {
        console.log(`[${new Date().toLocaleTimeString()}] ✅ Prediction success:`, prediction);
        // Ambil elemen HTML baru untuk nilai
        const predTempValEl = document.getElementById('pred_temp_val');
        const predHumValEl = document.getElementById('pred_hum_val');
        const predAirValEl = document.getElementById('pred_air_val');
        const predLastUpdateEl = document.getElementById('prediction_last_update');

        // Update nilai prediksi
        if (predTempValEl) predTempValEl.textContent = prediction.temperature_next?.toFixed(2) ?? '--';
        if (predHumValEl) predHumValEl.textContent = prediction.humidity_next?.toFixed(2) ?? '--';
        if (predAirValEl) predAirValEl.textContent = prediction.air_quality_next?.toFixed(2) ?? '--';
        
        // Update waktu prediksi
        if (predLastUpdateEl) {
            predLastUpdateEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        }
        
        // Panggil fungsi baru untuk update status kualitatif prediksi jika data valid
        if (prediction.temperature_next != null && prediction.humidity_next != null && prediction.air_quality_next != null) {
            updatePredictionStatus(prediction.temperature_next, prediction.humidity_next, prediction.air_quality_next);
        }
    })
    .catch(err => {
        console.error(`[${new Date().toLocaleTimeString()}] ❌ Prediction failed:`, err.message);
        // Reset tampilan jika terjadi error
        document.getElementById('pred_temp_val').textContent = '--';
        document.getElementById('pred_hum_val').textContent = '--';
        document.getElementById('pred_air_val').textContent = '--';
        document.getElementById('pred_temp_status').textContent = 'Error';
        document.getElementById('pred_hum_status').textContent = 'Error';
        document.getElementById('pred_air_status').textContent = 'Error';
        document.getElementById('prediction_last_update').textContent = 'Gagal';
    });
}


function initGauges() {
    console.log("initGauges: Memulai...");
    const tempDiv = document.getElementById('temp_gauge');
    const humidityDiv = document.getElementById('humidity_gauge');
    const airDiv = document.getElementById('air_gauge');
    if (!tempDiv || !humidityDiv || !airDiv) { console.error("initGauges: Div gauge tidak ditemukan!"); return; }
    try {
        tempGauge = new google.visualization.Gauge(tempDiv);
        humidityGauge = new google.visualization.Gauge(humidityDiv);
        airGauge = new google.visualization.Gauge(airDiv);
        tempGaugeData = google.visualization.arrayToDataTable([['Label', 'Value'], ['', 0]]);
        humidityGaugeData = google.visualization.arrayToDataTable([['Label', 'Value'], ['', 0]]);
        airGaugeData = google.visualization.arrayToDataTable([['Label', 'Value'], ['', 0]]);
        drawGauges(0, 0, 0); 
        console.log("initGauges: BERHASIL.");
    } catch (e) { console.error("initGauges: Error:", e); }
}

function initMinuteLineChart() {
    console.log("initMinuteLineChart: Memulai...");
    const lineChartDiv = document.getElementById('line_chart');
    const airChartDiv = document.getElementById('air_chart');
    
    if (!lineChartDiv) { console.error("initMinuteLineChart: div line_chart tidak ditemukan!"); return; }
    if (!airChartDiv) { console.error("initMinuteLineChart: div air_chart tidak ditemukan!"); return; }
    
    try {
        // Initialize Temperature & Humidity chart
        lineChart = new google.visualization.LineChart(lineChartDiv);
        console.log("initMinuteLineChart: Instance LineChart untuk temp/humidity dibuat.");
        redrawMinuteLineChart();
        
        // Initialize Air Quality chart
        airChart = new google.visualization.LineChart(airChartDiv);
        console.log("initMinuteLineChart: Instance LineChart untuk air quality dibuat.");
        redrawMinuteAirChart();
        
        console.log("initMinuteLineChart: BERHASIL diinisialisasi dan digambar awal.");
    } catch (e) { 
        console.error("initMinuteLineChart: Error membuat atau menggambar line chart awal:", e); 
    }
}

function drawGauges(temp, humidity, air) {
    try {
        if (tempGauge && tempGaugeData) { tempGaugeData.setValue(0, 1, parseFloat(temp) || 0); tempGauge.draw(tempGaugeData, tempOptions); }
        if (humidityGauge && humidityGaugeData) { humidityGaugeData.setValue(0, 1, parseFloat(humidity) || 0); humidityGauge.draw(humidityGaugeData, humidityOptions); }
        if (airGauge && airGaugeData) { airGaugeData.setValue(0, 1, parseFloat(air) || 0); airGauge.draw(airGaugeData, airOptions); }
    } catch (e) { console.error("drawGauges: Error:", e); }
}

function redrawMinuteLineChart() {
    if (!lineChart) { console.error("redrawMinuteLineChart: lineChart belum siap."); return; }
    let dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Waktu (Per Menit)');
    dataTable.addColumn('number', 'Temperatur (°C)');
    dataTable.addColumn('number', 'Kelembapan (%)');
    
    if (minuteLineChartData.length <= 1) {
        dataTable.addRow(['Memuat data...', null, null]);
    } else {
        for (let i = 1; i < minuteLineChartData.length; i++) {
            const rowData = [ 
                String(minuteLineChartData[i][0]), 
                parseFloat(minuteLineChartData[i][1]), 
                parseFloat(minuteLineChartData[i][2])
            ];
            if (isNaN(rowData[1])) rowData[1] = null;
            if (isNaN(rowData[2])) rowData[2] = null;
            dataTable.addRow(rowData);
        }
    }
    try { lineChart.draw(dataTable, minuteLineChartOptions); }
    catch (e) { console.error("redrawMinuteLineChart: Error saat lineChart.draw():", e); }
}

function redrawMinuteAirChart() {
    if (!airChart) { console.error("redrawMinuteAirChart: airChart belum siap."); return; }
    let dataTable = new google.visualization.DataTable();
    dataTable.addColumn('string', 'Waktu (Per Menit)');
    dataTable.addColumn('number', 'Kualitas Udara (PPM)');
    
    if (minuteAirChartData.length <= 1) {
        dataTable.addRow(['Memuat data...', null]);
    } else {
        for (let i = 1; i < minuteAirChartData.length; i++) {
            const rowData = [ 
                String(minuteAirChartData[i][0]), 
                parseFloat(minuteAirChartData[i][1])
            ];
            if (isNaN(rowData[1])) rowData[1] = null;
            dataTable.addRow(rowData);
        }
    }
    try { airChart.draw(dataTable, minuteAirChartOptions); }
    catch (e) { console.error("redrawMinuteAirChart: Error saat airChart.draw():", e); }
}

function getMinuteLabel(timestamp) {
    // ... (fungsi ini tidak berubah)
    try {
        const dateObj = new Date(timestamp.replace(' ', 'T')); 
        if (isNaN(dateObj.getTime())) {
            const timeStr = timestamp.split(' ')[1];
            if (timeStr) { const parts = timeStr.split(':'); if (parts.length >= 2) return String(parts[0]).padStart(2,'0') + ":" + String(parts[1]).padStart(2,'0');}
            console.warn("getMinuteLabel: Gagal parse timestamp:", timestamp);
            return null;
        }
        return String(dateObj.getHours()).padStart(2, '0') + ":" + String(dateObj.getMinutes()).padStart(2, '0');
    } catch (e) { console.error("getMinuteLabel: Error memproses timestamp:", timestamp, e); return null; }
}

function processSensorDataForMinuteChart(timestamp, currentRawTempStr, currentRawHumStr, currentRawAqFloat) {
    const incomingMinuteLabel = getMinuteLabel(timestamp);
    if (!incomingMinuteLabel) { 
        console.warn(`[${new Date().toLocaleTimeString()}] processSensorDataForMinuteChart: Label menit tidak valid untuk TS ${timestamp}, data dilewati.`); 
        return; 
    }

    const numTemp = parseFloat(currentRawTempStr);
    const numHum = parseFloat(currentRawHumStr);
    const numAir = parseFloat(currentRawAqFloat);

    if (isNaN(numTemp) || isNaN(numHum) || isNaN(numAir)) {
        console.warn(`[${new Date().toLocaleTimeString()}] processSensorDataForMinuteChart: Data T/H/AQ NaN dilewati: T=${currentRawTempStr}, H=${currentRawHumStr}, AQ=${currentRawAqFloat}`);
        return;
    }

    if (currentMinuteAccumulator.minuteLabel === null) {
        currentMinuteAccumulator.minuteLabel = incomingMinuteLabel;
        currentMinuteAccumulator.sumTemp = numTemp;
        currentMinuteAccumulator.sumHum = numHum;
        currentMinuteAccumulator.sumAir = numAir;
        currentMinuteAccumulator.count = 1;
    } else if (currentMinuteAccumulator.minuteLabel !== incomingMinuteLabel) {
        if (currentMinuteAccumulator.count > 0) {
            const avgTemp = currentMinuteAccumulator.sumTemp / currentMinuteAccumulator.count;
            const avgHum = currentMinuteAccumulator.sumHum / currentMinuteAccumulator.count;
            const avgAir = currentMinuteAccumulator.sumAir / currentMinuteAccumulator.count;
            
            // Add to temperature & humidity chart
            const tempHumData = [
                String(currentMinuteAccumulator.minuteLabel), 
                parseFloat(avgTemp.toFixed(2)), 
                parseFloat(avgHum.toFixed(2))
            ];
            minuteLineChartData.push(tempHumData);
            
            // Add to air quality chart
            const airData = [
                String(currentMinuteAccumulator.minuteLabel), 
                parseFloat(avgAir.toFixed(2))
            ];
            minuteAirChartData.push(airData);
            
            // Maintain maximum points for both charts
            while (minuteLineChartData.length > MAX_MINUTE_POINTS + 1) {
                minuteLineChartData.splice(1, 1);
            }
            while (minuteAirChartData.length > MAX_MINUTE_POINTS + 1) {
                minuteAirChartData.splice(1, 1);
            }
            
            // Redraw both charts
            redrawMinuteLineChart();
            redrawMinuteAirChart();
            
            getPrediction(numTemp, numHum, numAir);
        }

        currentMinuteAccumulator.minuteLabel = incomingMinuteLabel;
        currentMinuteAccumulator.sumTemp = numTemp;
        currentMinuteAccumulator.sumHum = numHum;
        currentMinuteAccumulator.sumAir = numAir;
        currentMinuteAccumulator.count = 1;
    } else {
        currentMinuteAccumulator.sumTemp += numTemp;
        currentMinuteAccumulator.sumHum += numHum;
        currentMinuteAccumulator.sumAir += numAir;
        currentMinuteAccumulator.count++;
    }
}

function setupClock() {
    const clockElement = document.getElementById('liveClock');
    const dateElement = document.getElementById('liveDate');
    
    if (clockElement) {
        function updateClockAndDate() {
            const now = new Date();
            
            // Update clock
            clockElement.textContent = now.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                hour12: false 
            });
            
            // Update date
            if (dateElement) {
                const options = { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                };
                dateElement.textContent = now.toLocaleDateString('id-ID', options);
            }
        }
        
        setInterval(updateClockAndDate, 1000);
        updateClockAndDate();
    }
}

function setupSocketListeners() {
    // ... (fungsi ini tidak berubah)
    if (typeof io === 'undefined') { console.error("Socket.IO client tidak termuat."); return; }
    
    if (window.socket && window.socket.connected) { return; }
    
    window.socket = io(); 
    console.log("setupSocketListeners: Mencoba koneksi Socket.IO...");

    window.socket.on('sensor_data', function (data) {
        const rawTimestamp = data.timestamp;
        const temperatureString = data.temperature; 
        const humidityString = data.humidity;     
        const currentAirQualityValue = parseFloat(data.air_quality) || 0;

        if (!rawTimestamp || typeof temperatureString === 'undefined' || typeof humidityString === 'undefined') {
            console.warn(`[${new Date().toLocaleTimeString()}] setupSocketListeners: Data sensor tidak lengkap diterima:`, data);
            return;
        }

        const numTemperatureForGauge = parseFloat(temperatureString) || 0;
        const numHumidityForGauge = parseFloat(humidityString) || 0;

        const lastUpdateElement = document.getElementById('lastUpdate');
        if (lastUpdateElement) { lastUpdateElement.textContent = rawTimestamp; }

        // Update unified dashboard (combines gauges, live values, and status)
        drawGauges(numTemperatureForGauge, numHumidityForGauge, currentAirQualityValue);
        updateDashboard(numTemperatureForGauge, numHumidityForGauge, currentAirQualityValue, rawTimestamp);
        
        processSensorDataForMinuteChart(rawTimestamp, temperatureString, humidityString, currentAirQualityValue);
    });

    window.socket.on('connect', () => { 
        console.log(`[${new Date().toLocaleTimeString()}] Socket.IO: Terhubung dengan ID: ${window.socket.id}`); 
        updateConnectionStatus(true);
    });
    window.socket.on('disconnect', (reason) => { 
        console.warn(`[${new Date().toLocaleTimeString()}] Socket.IO: Terputus. Alasan: ${reason}.`); 
        updateConnectionStatus(false);
    });
    window.socket.on('connect_error', (err) => { 
        console.error(`[${new Date().toLocaleTimeString()}] Socket.IO Error Koneksi:`, err); 
        updateConnectionStatus(false);
    });
}

// Global scope, dipanggil dari inline script di HTML
function fetchInitialPrediction() {
    console.log(`[${new Date().toLocaleTimeString()}] Mengambil data terakhir untuk prediksi awal...`);
    fetch("/latest")
      .then(res => {
          if (!res.ok) {
              return res.json().catch(() => ({ error: `Failed to parse error JSON. Status: ${res.status}` }))
                             .then(errData => {
                                 throw new Error(errData.error || `HTTP error! status: ${res.status} fetching /latest`);
                             });
          }
          return res.json();
      })
      .then(data => {
        console.log(`[${new Date().toLocaleTimeString()}] Data dari /latest:`, data);
        if (data && data.temperature != null && data.humidity != null && data.air_quality != null) {
            // Update unified dashboard with initial data
            updateDashboard(data.temperature, data.humidity, data.air_quality);
            // Get prediction
            getPrediction(data.temperature, data.humidity, data.air_quality);
        } else {
            console.warn(`[${new Date().toLocaleTimeString()}] Data awal dari /latest tidak lengkap atau hilang untuk prediksi.`, data);
            // Reset tampilan jika data awal tidak lengkap
            document.getElementById('pred_temp_val').textContent = '--';
            document.getElementById('pred_hum_val').textContent = '--';
            document.getElementById('pred_air_val').textContent = '--';
            document.getElementById('pred_temp_status').textContent = '--';
            document.getElementById('pred_hum_status').textContent = '--';
            document.getElementById('pred_air_status').textContent = '--';
            // Set connection status to disconnected
            updateConnectionStatus(false);
        }
      })
      .catch(err => {
          console.error(`[${new Date().toLocaleTimeString()}] Error saat penyiapan prediksi awal (fetch /latest):`, err.message);
          // Reset tampilan jika fetch awal gagal
          document.getElementById('pred_temp_val').textContent = '--';
          document.getElementById('pred_hum_val').textContent = '--';
          document.getElementById('pred_air_val').textContent = '--';
          document.getElementById('pred_temp_status').textContent = 'Error';
          document.getElementById('pred_hum_status').textContent = 'Error';
          document.getElementById('pred_air_status').textContent = 'Error';
          document.getElementById('prediction_last_update').textContent = 'Gagal';
          // Set connection status to disconnected
          updateConnectionStatus(false);
      });
}

// --- PEMANGGILAN FUNGSI INISIALISASI UTAMA ---
// Dipanggil oleh google.charts.setOnLoadCallback di file HTML
// Fungsi ini harus ada di global scope agar bisa diakses
function initializeAllVisuals() {
    console.log("initializeAllVisuals: Memulai...");
    initGauges();
    initMinuteLineChart();
    initDashboardElements(); // Initialize unified dashboard elements
    setupSocketListeners(); // Panggil listener socket setelah visual siap
    fetchInitialPrediction(); 
    console.log("initializeAllVisuals: Selesai.");
}

document.addEventListener('DOMContentLoaded', function() {
    console.log(`[${new Date().toLocaleTimeString()}] DOM siap. Memanggil setupClock dan google.charts.load.`);
    setupClock();
    
    if (typeof google !== 'undefined' && typeof google.charts !== 'undefined') {
        google.charts.load('current', { packages: ['gauge', 'corechart'] });
        google.charts.setOnLoadCallback(initializeAllVisuals);
    } else {
        console.error("Google Charts loader tidak ditemukan. Pastikan library dimuat dengan benar.");
    }
    
    const lineChartDiv = document.getElementById('line_chart');
    const airChartDiv = document.getElementById('air_chart');
    if (lineChartDiv || airChartDiv) {
        window.addEventListener('resize', function() {
            if (lineChart) {
                redrawMinuteLineChart();
            }
            if (airChart) {
                redrawMinuteAirChart();
            }
        });
    }
});