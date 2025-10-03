// AI Traffic Management Dashboard - Complete Implementation

// Global application state
const AppState = {
    simulation: {
        isRunning: true,
        speed: 1,
        currentIntersection: 'main-oak',
        systemMode: 'ai',
        trafficDemand: 'normal',
        emergencyActive: false
    },
    trafficLights: {
        currentPhase: 'ns-green',
        phaseTime: 25,
        greenDuration: 35,
        yellowDuration: 5,
        redDuration: 30,
        cycleTime: 70
    },
    vehicles: [],
    nextVehicleId: 1,
    kpis: {
        avgCommuteTime: 12.3,
        throughput: 1247,
        avgWaitTime: 2.1,
        efficiency: 87,
        co2Savings: 15.2,
        cycletime: 68
    },
    queues: {
        north: 3,
        south: 5,
        east: 8,
        west: 6
    },
    charts: {},
    intervals: {}
};

// Application data from JSON
const TrafficData = {
    intersections: {
        'main-oak': { name: 'Main St & Oak Ave', nsPhase: 'green', ewPhase: 'red' },
        'park-first': { name: 'Park Rd & 1st St', nsPhase: 'red', ewPhase: 'green' },
        'broadway-42': { name: 'Broadway & 42nd', nsPhase: 'yellow', ewPhase: 'red' },
        'fifth-59': { name: '5th Ave & 59th', nsPhase: 'red', ewPhase: 'green' }
    },
    analytics: {
        hourlyTraffic: [
            { hour: '00:00', volume: 180 }, { hour: '01:00', volume: 120 },
            { hour: '02:00', volume: 85 }, { hour: '03:00', volume: 65 },
            { hour: '04:00', volume: 90 }, { hour: '05:00', volume: 240 },
            { hour: '06:00', volume: 580 }, { hour: '07:00', volume: 920 },
            { hour: '08:00', volume: 1150 }, { hour: '09:00', volume: 850 },
            { hour: '10:00', volume: 720 }, { hour: '11:00', volume: 680 }
        ],
        waitTimesByDirection: [
            { direction: 'North', avgWait: 1.8 },
            { direction: 'South', avgWait: 2.3 },
            { direction: 'East', avgWait: 2.7 },
            { direction: 'West', avgWait: 1.9 }
        ],
        vehicleTypes: [
            { type: 'Cars', percentage: 70, color: '#3b82f6' },
            { type: 'Trucks', percentage: 15, color: '#10b981' },
            { type: 'Buses', percentage: 10, color: '#f59e0b' },
            { type: 'Others', percentage: 5, color: '#ef4444' }
        ],
        optimizationImpact: [
            { period: 'Week 1', before: 16.2, after: 14.1 },
            { period: 'Week 2', before: 15.8, after: 13.6 },
            { period: 'Week 3', before: 16.5, after: 12.9 },
            { period: 'Week 4', before: 15.9, after: 12.3 }
        ]
    }
};

// Initialize application when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing AI Traffic Management Dashboard...');
    
    initializeEventListeners();
    initializeCharts();
    updateCurrentTime();
    startTrafficSimulation();
    startKPIUpdates();
    initializeAIBackendControls();
    
    // Update time every second
    setInterval(updateCurrentTime, 1000);
    
    console.log('Dashboard initialized successfully');
});

// Event Listeners Setup
function initializeEventListeners() {
    // Intersection selection
    document.getElementById('intersectionSelect').addEventListener('change', handleIntersectionChange);
    
    // System mode buttons
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', handleModeChange);
    });
    
    // Signal timing sliders
    ['greenSlider', 'yellowSlider', 'redSlider', 'speedSlider'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) slider.addEventListener('input', handleSliderChange);
    });
    
    // Simulation controls
    document.getElementById('playBtn').addEventListener('click', () => toggleSimulation(true));
    document.getElementById('pauseBtn').addEventListener('click', () => toggleSimulation(false));
    document.getElementById('resetBtn').addEventListener('click', resetSimulation);
    
    // Traffic demand
    document.getElementById('trafficDemand').addEventListener('change', handleTrafficDemandChange);
    
    // Emergency controls
    document.querySelector('.emergency-override').addEventListener('click', handleEmergencyOverride);
    document.querySelector('.emergency-btn').addEventListener('click', handleEmergencyOverride);
    
    // Incident buttons
    document.querySelectorAll('[data-incident]').forEach(btn => {
        btn.addEventListener('click', handleIncidentTrigger);
    });
}

// Backend AI controls
function initializeAIBackendControls() {
    const optimizeBtn = document.getElementById('optimizeBtn');
    if (optimizeBtn) {
        optimizeBtn.addEventListener('click', async () => {
            const densities = estimateDensitiesFromQueues();
            await requestOptimization(densities);
        });
    }
}

function estimateDensitiesFromQueues() {
    const q = AppState.queues;
    const maxQ = Math.max(1, q.north + q.south + q.east + q.west);
    return {
        north: +(q.north / maxQ).toFixed(3),
        south: +(q.south / maxQ).toFixed(3),
        east: +(q.east / maxQ).toFixed(3),
        west: +(q.west / maxQ).toFixed(3)
    };
}

async function requestOptimization(densities) {
    const urlInput = document.getElementById('backendUrl');
    const baseUrl = urlInput ? urlInput.value : 'http://127.0.0.1:8000';
    try {
        const res = await fetch(baseUrl + '/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ densities })
        });
        const plan = await res.json();
        applyPhasePlan(plan && plan.phase_plan ? plan.phase_plan : null);
    } catch (e) {
        console.error('Optimization error', e);
    }
}

function applyPhasePlan(phasePlan) {
    if (!phasePlan) return;
    const { ns_green, ns_yellow, ew_green, ew_yellow } = phasePlan;
    // Update durations and reset phase timer to start cycle fresh
    AppState.trafficLights.greenDuration = Math.max(10, parseInt(ns_green || AppState.trafficLights.greenDuration));
    AppState.trafficLights.yellowDuration = Math.max(3, parseInt(ns_yellow || AppState.trafficLights.yellowDuration));
    // We model EW by cycling; store EW green in a shadow field to bias spawn and allow cycle calc
    AppState.trafficLights._ewGreen = Math.max(10, parseInt(ew_green || 20));
    AppState.trafficLights._ewYellow = Math.max(3, parseInt(ew_yellow || 5));
    AppState.trafficLights.phaseTime = AppState.trafficLights.greenDuration;
}

// Traffic Light Simulation
function startTrafficSimulation() {
    if (AppState.intervals.trafficLights) {
        clearInterval(AppState.intervals.trafficLights);
    }
    
    AppState.intervals.trafficLights = setInterval(() => {
        if (AppState.simulation.isRunning && !AppState.simulation.emergencyActive) {
            updateTrafficLightCycle();
            updateVehicleSimulation();
            updateDetectionZones();
        }
    }, 1000 / AppState.simulation.speed);
    
    // Start vehicle spawning
    startVehicleSpawning();
}

function updateTrafficLightCycle() {
    AppState.trafficLights.phaseTime--;
    
    // Update countdown display
    const countdown = document.getElementById('north-countdown');
    if (countdown) {
        countdown.textContent = Math.max(0, AppState.trafficLights.phaseTime) + 's';
    }
    
    if (AppState.trafficLights.phaseTime <= 0) {
        switchTrafficLightPhase();
    }
    
    updateTrafficLightDisplay();
}

function switchTrafficLightPhase() {
    const currentPhase = AppState.trafficLights.currentPhase;
    
    switch (currentPhase) {
        case 'ns-green':
            AppState.trafficLights.currentPhase = 'ns-yellow';
            AppState.trafficLights.phaseTime = AppState.trafficLights.yellowDuration;
            break;
        case 'ns-yellow':
            AppState.trafficLights.currentPhase = 'ew-green';
            AppState.trafficLights.phaseTime = AppState.trafficLights.greenDuration;
            break;
        case 'ew-green':
            AppState.trafficLights.currentPhase = 'ew-yellow';
            AppState.trafficLights.phaseTime = AppState.trafficLights.yellowDuration;
            break;
        case 'ew-yellow':
            AppState.trafficLights.currentPhase = 'ns-green';
            AppState.trafficLights.phaseTime = AppState.trafficLights.greenDuration;
            break;
    }
}

function updateTrafficLightDisplay() {
    const phase = AppState.trafficLights.currentPhase;
    
    // Reset all lights
    document.querySelectorAll('.light').forEach(light => {
        light.classList.remove('active');
    });
    
    // Activate appropriate lights
    switch (phase) {
        case 'ns-green':
            document.getElementById('north-green').classList.add('active');
            document.getElementById('south-green').classList.add('active');
            document.getElementById('east-red').classList.add('active');
            document.getElementById('west-red').classList.add('active');
            updateLightLabels('N-S Green', 'E-W Red');
            break;
        case 'ns-yellow':
            document.getElementById('north-yellow').classList.add('active');
            document.getElementById('south-yellow').classList.add('active');
            document.getElementById('east-red').classList.add('active');
            document.getElementById('west-red').classList.add('active');
            updateLightLabels('N-S Yellow', 'E-W Red');
            break;
        case 'ew-green':
            document.getElementById('north-red').classList.add('active');
            document.getElementById('south-red').classList.add('active');
            document.getElementById('east-green').classList.add('active');
            document.getElementById('west-green').classList.add('active');
            updateLightLabels('N-S Red', 'E-W Green');
            break;
        case 'ew-yellow':
            document.getElementById('north-red').classList.add('active');
            document.getElementById('south-red').classList.add('active');
            document.getElementById('east-yellow').classList.add('active');
            document.getElementById('west-yellow').classList.add('active');
            updateLightLabels('N-S Red', 'E-W Yellow');
            break;
    }
}

function updateLightLabels(nsLabel, ewLabel) {
    const labels = document.querySelectorAll('.light-label');
    if (labels.length >= 4) {
        labels[0].textContent = nsLabel;
        labels[1].textContent = nsLabel;
        labels[2].textContent = ewLabel;
        labels[3].textContent = ewLabel;
    }
}

// Vehicle Simulation
function startVehicleSpawning() {
    if (AppState.intervals.vehicleSpawning) {
        clearInterval(AppState.intervals.vehicleSpawning);
    }
    
    AppState.intervals.vehicleSpawning = setInterval(() => {
        if (!AppState.simulation.isRunning) return;
        const p = spawnProbabilityByDensities();
        if (Math.random() < p.total) spawnVehicleWeighted(p.byDirection);
    }, 1000 / AppState.simulation.speed);
}

function spawnVehicle() {
    const directions = ['north', 'south', 'east', 'west'];
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const vehicleTypes = [
        { type: 'car', weight: 70 },
        { type: 'truck', weight: 15 },
        { type: 'bus', weight: 10 }
    ];
    
    // Select vehicle type based on weights
    const random = Math.random() * 95;
    let cumulativeWeight = 0;
    let selectedType = 'car';
    
    for (const vType of vehicleTypes) {
        cumulativeWeight += vType.weight;
        if (random <= cumulativeWeight) {
            selectedType = vType.type;
            break;
        }
    }
    
    const vehicle = createVehicle(direction, selectedType);
    if (vehicle) {
        AppState.vehicles.push(vehicle);
        renderVehicle(vehicle);
    }
}

function spawnVehicleWeighted(weights) {
    const dirs = Object.keys(weights);
    const r = Math.random();
    let acc = 0;
    let chosen = 'north';
    for (const d of dirs) {
        acc += weights[d];
        if (r <= acc) { chosen = d; break; }
    }
    const vehicleTypes = [
        { type: 'car', weight: 70 },
        { type: 'truck', weight: 15 },
        { type: 'bus', weight: 10 }
    ];
    const random = Math.random() * 95;
    let cumulativeWeight = 0;
    let selectedType = 'car';
    for (const vType of vehicleTypes) {
        cumulativeWeight += vType.weight;
        if (random <= cumulativeWeight) { selectedType = vType.type; break; }
    }
    const vehicle = createVehicle(chosen, selectedType);
    if (vehicle) {
        AppState.vehicles.push(vehicle);
        renderVehicle(vehicle);
    }
}

function spawnProbabilityByDensities() {
    const q = AppState.queues;
    const sum = q.north + q.south + q.east + q.west;
    const base = 0.4; // overall spawn baseline
    const byDirection = sum > 0 ? {
        north: q.north / sum,
        south: q.south / sum,
        east: q.east / sum,
        west: q.west / sum
    } : { north: 0.25, south: 0.25, east: 0.25, west: 0.25 };
    return { total: base, byDirection };
}

function createVehicle(direction, type) {
    const vehicle = {
        id: AppState.nextVehicleId++,
        type: type,
        direction: direction,
        position: 0,
        speed: getVehicleSpeed(type),
        waiting: false,
        element: null
    };
    
    return vehicle;
}

function getVehicleSpeed(type) {
    switch (type) {
        case 'car': return 2 + Math.random();
        case 'truck': return 1.5 + Math.random() * 0.5;
        case 'bus': return 1.8 + Math.random() * 0.4;
        default: return 2;
    }
}

function renderVehicle(vehicle) {
    const vehiclesContainer = document.getElementById('vehiclesContainer');
    const vehicleElement = document.createElement('div');
    
    vehicleElement.className = `vehicle ${vehicle.type}`;
    vehicleElement.id = `vehicle-${vehicle.id}`;
    
    // Set initial position based on direction
    const startPositions = {
        north: { left: '47%', top: '100%' },
        south: { left: '53%', top: '0%' },
        east: { left: '0%', top: '47%' },
        west: { left: '100%', top: '53%' }
    };
    
    const startPos = startPositions[vehicle.direction];
    vehicleElement.style.left = startPos.left;
    vehicleElement.style.top = startPos.top;
    
    vehiclesContainer.appendChild(vehicleElement);
    vehicle.element = vehicleElement;
}

function updateVehicleSimulation() {
    AppState.vehicles.forEach((vehicle, index) => {
        if (vehicle.element) {
            updateVehiclePosition(vehicle);
            
            // Remove vehicles that have left the intersection
            if (isVehicleOffScreen(vehicle)) {
                vehicle.element.remove();
                AppState.vehicles.splice(index, 1);
            }
        }
    });
    
    updateQueueCounts();
}

function updateVehiclePosition(vehicle) {
    if (!vehicle.element) return;
    
    const canMove = canVehicleMove(vehicle);
    vehicle.waiting = !canMove;
    
    if (canMove) {
        vehicle.position += vehicle.speed * AppState.simulation.speed;
        
        const newPosition = calculateVehiclePosition(vehicle);
        vehicle.element.style.left = newPosition.left;
        vehicle.element.style.top = newPosition.top;
    }
}

function canVehicleMove(vehicle) {
    const phase = AppState.trafficLights.currentPhase;
    const intersectionApproach = vehicle.position > 40 && vehicle.position < 60;
    
    if (!intersectionApproach) return true;
    
    // Check traffic light status
    if ((vehicle.direction === 'north' || vehicle.direction === 'south') && 
        (phase === 'ns-green')) return true;
    if ((vehicle.direction === 'east' || vehicle.direction === 'west') && 
        (phase === 'ew-green')) return true;
    if (phase.includes('yellow') && vehicle.position > 50) return true;
    
    return false;
}

function calculateVehiclePosition(vehicle) {
    const progress = vehicle.position;
    
    switch (vehicle.direction) {
        case 'north':
            return { 
                left: '47%', 
                top: (100 - progress) + '%' 
            };
        case 'south':
            return { 
                left: '53%', 
                top: progress + '%' 
            };
        case 'east':
            return { 
                left: progress + '%', 
                top: '47%' 
            };
        case 'west':
            return { 
                left: (100 - progress) + '%', 
                top: '53%' 
            };
        default:
            return { left: '50%', top: '50%' };
    }
}

function isVehicleOffScreen(vehicle) {
    return vehicle.position > 120;
}

function updateQueueCounts() {
    const queues = { north: 0, south: 0, east: 0, west: 0 };
    
    AppState.vehicles.forEach(vehicle => {
        if (vehicle.waiting && vehicle.position > 30 && vehicle.position < 60) {
            queues[vehicle.direction]++;
        }
    });
    
    AppState.queues = queues;
    
    // Update display
    Object.keys(queues).forEach(direction => {
        const element = document.getElementById(`queue${direction.charAt(0).toUpperCase() + direction.slice(1)}`);
        if (element) {
            element.textContent = queues[direction];
        }
    });
}

function updateDetectionZones() {
    const zones = ['north', 'south', 'east', 'west'];
    
    zones.forEach(direction => {
        const zone = document.getElementById(`detection${direction.charAt(0).toUpperCase() + direction.slice(1)}`);
        const hasVehicle = AppState.vehicles.some(vehicle => 
            vehicle.direction === direction && 
            vehicle.position > 35 && 
            vehicle.position < 65
        );
        
        if (zone) {
            zone.classList.toggle('active', hasVehicle);
        }
    });
}

// Charts Initialization
function initializeCharts() {
    initializeHourlyTrafficChart();
    initializeWaitTimesChart();
    initializeVehicleTypesChart();
    initializeOptimizationChart();
}

function initializeHourlyTrafficChart() {
    const ctx = document.getElementById('hourlyTrafficChart').getContext('2d');
    AppState.charts.hourlyTraffic = new Chart(ctx, {
        type: 'line',
        data: {
            labels: TrafficData.analytics.hourlyTraffic.map(d => d.hour),
            datasets: [{
                label: 'Vehicle Volume',
                data: TrafficData.analytics.hourlyTraffic.map(d => d.volume),
                borderColor: '#1FB8CD',
                backgroundColor: 'rgba(31, 184, 205, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Hourly Traffic Volume',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
                },
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() },
                    grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() }
                },
                x: {
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() },
                    grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() }
                }
            }
        }
    });
}

function initializeWaitTimesChart() {
    const ctx = document.getElementById('waitTimesChart').getContext('2d');
    AppState.charts.waitTimes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: TrafficData.analytics.waitTimesByDirection.map(d => d.direction),
            datasets: [{
                label: 'Average Wait Time (min)',
                data: TrafficData.analytics.waitTimesByDirection.map(d => d.avgWait),
                backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#5D878F']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Wait Times by Direction',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
                },
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() },
                    grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() }
                },
                x: {
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() },
                    grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() }
                }
            }
        }
    });
}

function initializeVehicleTypesChart() {
    const ctx = document.getElementById('vehicleTypesChart').getContext('2d');
    AppState.charts.vehicleTypes = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: TrafficData.analytics.vehicleTypes.map(d => d.type),
            datasets: [{
                data: TrafficData.analytics.vehicleTypes.map(d => d.percentage),
                backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Vehicle Type Distribution',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function initializeOptimizationChart() {
    const ctx = document.getElementById('optimizationChart').getContext('2d');
    AppState.charts.optimization = new Chart(ctx, {
        type: 'line',
        data: {
            labels: TrafficData.analytics.optimizationImpact.map(d => d.period),
            datasets: [
                {
                    label: 'Before AI',
                    data: TrafficData.analytics.optimizationImpact.map(d => d.before),
                    borderColor: '#B4413C',
                    backgroundColor: 'rgba(180, 65, 60, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.4
                },
                {
                    label: 'After AI',
                    data: TrafficData.analytics.optimizationImpact.map(d => d.after),
                    borderColor: '#1FB8CD',
                    backgroundColor: 'rgba(31, 184, 205, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Signal Optimization Impact',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim()
                },
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
                        font: { size: 10 }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() },
                    grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() }
                },
                x: {
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim() },
                    grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() }
                }
            }
        }
    });
}

// KPI Updates
function startKPIUpdates() {
    if (AppState.intervals.kpiUpdates) {
        clearInterval(AppState.intervals.kpiUpdates);
    }
    
    AppState.intervals.kpiUpdates = setInterval(() => {
        if (AppState.simulation.isRunning) {
            updateKPIValues();
            updateKPIDisplay();
        }
    }, 3000);
}

function updateKPIValues() {
    const baseVariation = 0.02;
    const demandMultiplier = {
        'light': 0.8,
        'normal': 1.0,
        'heavy': 1.3,
        'rush': 1.6
    }[AppState.simulation.trafficDemand];
    
    // Apply realistic variations
    AppState.kpis.avgCommuteTime += (Math.random() - 0.5) * baseVariation * demandMultiplier;
    AppState.kpis.avgWaitTime += (Math.random() - 0.5) * baseVariation * demandMultiplier;
    AppState.kpis.throughput += Math.floor((Math.random() - 0.5) * 20 * demandMultiplier);
    AppState.kpis.efficiency += (Math.random() - 0.5) * baseVariation;
    
    // Clamp values within realistic ranges
    AppState.kpis.avgCommuteTime = Math.max(8, Math.min(25, AppState.kpis.avgCommuteTime));
    AppState.kpis.avgWaitTime = Math.max(1, Math.min(6, AppState.kpis.avgWaitTime));
    AppState.kpis.throughput = Math.max(800, Math.min(2200, AppState.kpis.throughput));
    AppState.kpis.efficiency = Math.max(60, Math.min(95, AppState.kpis.efficiency));
}

function updateKPIDisplay() {
    document.getElementById('kpi-commute').textContent = AppState.kpis.avgCommuteTime.toFixed(1);
    document.getElementById('kpi-throughput').textContent = AppState.kpis.throughput.toLocaleString();
    document.getElementById('kpi-wait').textContent = AppState.kpis.avgWaitTime.toFixed(1);
    document.getElementById('kpi-efficiency').textContent = AppState.kpis.efficiency.toFixed(0);
    document.getElementById('kpi-co2').textContent = AppState.kpis.co2Savings.toFixed(1);
    document.getElementById('kpi-cycle').textContent = AppState.kpis.cycletime;
}

// Event Handlers
function handleIntersectionChange(event) {
    AppState.simulation.currentIntersection = event.target.value;
    const intersection = TrafficData.intersections[AppState.simulation.currentIntersection];
    
    // Update simulation header
    document.querySelector('.simulation-header h2').textContent = 
        `Live Traffic Simulation - ${intersection.name}`;
}

function handleModeChange(event) {
    const mode = event.target.dataset.mode;
    AppState.simulation.systemMode = mode;
    
    // Update button states
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.classList.remove('active', 'btn--primary');
        btn.classList.add('btn--secondary');
    });
    
    event.target.classList.add('active', 'btn--primary');
    event.target.classList.remove('btn--secondary');
}

function handleSliderChange(event) {
    const sliderId = event.target.id;
    const value = parseInt(event.target.value);
    
    switch(sliderId) {
        case 'greenSlider':
            AppState.trafficLights.greenDuration = value;
            document.getElementById('greenValue').textContent = value;
            break;
        case 'yellowSlider':
            AppState.trafficLights.yellowDuration = value;
            document.getElementById('yellowValue').textContent = value;
            break;
        case 'redSlider':
            AppState.trafficLights.redDuration = value;
            document.getElementById('redValue').textContent = value;
            break;
        case 'speedSlider':
            AppState.simulation.speed = value;
            document.getElementById('speedValue').textContent = value + 'x';
            // Restart intervals with new speed
            startTrafficSimulation();
            break;
    }
    
    // Update cycle time
    AppState.trafficLights.cycleTime = 
        (AppState.trafficLights.greenDuration * 2) + 
        (AppState.trafficLights.yellowDuration * 2) + 
        (AppState.trafficLights.redDuration * 2);
}

function toggleSimulation(running) {
    AppState.simulation.isRunning = running;
    
    // Update button states
    document.getElementById('playBtn').classList.toggle('active', running);
    document.getElementById('pauseBtn').classList.toggle('active', !running);
    
    // Update simulation status
    const statusElement = document.querySelector('.simulation-status span:last-child');
    if (statusElement) {
        statusElement.textContent = running ? 'Simulation Running' : 'Simulation Paused';
    }
    
    const statusDot = document.querySelector('.status-dot.running');
    if (statusDot) {
        statusDot.style.animationPlayState = running ? 'running' : 'paused';
    }
}

function resetSimulation() {
    // Clear all vehicles
    AppState.vehicles.forEach(vehicle => {
        if (vehicle.element) vehicle.element.remove();
    });
    AppState.vehicles = [];
    
    // Reset traffic lights to initial state
    AppState.trafficLights.currentPhase = 'ns-green';
    AppState.trafficLights.phaseTime = AppState.trafficLights.greenDuration;
    
    // Reset KPIs to baseline values
    AppState.kpis = {
        avgCommuteTime: 12.3,
        throughput: 1247,
        avgWaitTime: 2.1,
        efficiency: 87,
        co2Savings: 15.2,
        cycletime: 68
    };
    
    updateKPIDisplay();
    updateTrafficLightDisplay();
}

function handleTrafficDemandChange(event) {
    AppState.simulation.trafficDemand = event.target.value;
}

function handleEmergencyOverride() {
    AppState.simulation.emergencyActive = !AppState.simulation.emergencyActive;
    
    if (AppState.simulation.emergencyActive) {
        // Set all lights to red
        document.querySelectorAll('.light').forEach(light => {
            light.classList.remove('active');
        });
        
        document.querySelectorAll('.light.red').forEach(light => {
            light.classList.add('active');
        });
        
        updateLightLabels('Emergency - All Stop', 'Emergency - All Stop');
        
        // Pause simulation
        toggleSimulation(false);
        
        alert('Emergency Override Activated - All signals RED');
    } else {
        // Resume normal operation
        toggleSimulation(true);
        alert('Emergency Override Deactivated - Resuming normal operation');
    }
}

function handleIncidentTrigger(event) {
    const incident = event.target.dataset.incident;
    let message = '';
    
    switch(incident) {
        case 'accident':
            message = 'Traffic accident simulated - Increasing delays';
            AppState.kpis.avgCommuteTime += 2.5;
            AppState.kpis.avgWaitTime += 1.2;
            break;
        case 'roadwork':
            message = 'Road work zone activated - Reduced capacity';
            AppState.kpis.throughput *= 0.85;
            AppState.kpis.efficiency -= 8;
            break;
        case 'blocked':
            message = 'Lane blocked - Redirecting traffic';
            AppState.kpis.avgWaitTime += 0.8;
            AppState.kpis.efficiency -= 5;
            break;
    }
    
    // Show temporary alert
    alert(message);
    
    // Auto-recover after 30 seconds
    setTimeout(() => {
        AppState.kpis = {
            avgCommuteTime: 12.3,
            throughput: 1247,
            avgWaitTime: 2.1,
            efficiency: 87,
            co2Savings: 15.2,
            cycletime: 68
        };
    }, 30000);
}

// Utility Functions
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    
    const timeElement = document.getElementById('currentTime');
    if (timeElement) {
        timeElement.textContent = timeString;
    }
    
    // Update timestamp in simulation
    const timestamp = document.querySelector('.timestamp');
    if (timestamp) {
        timestamp.textContent = now.toLocaleTimeString('en-US', { hour12: true });
    }
}

// Cleanup function for when page unloads
window.addEventListener('beforeunload', function() {
    Object.values(AppState.intervals).forEach(interval => {
        if (interval) clearInterval(interval);
    });
});