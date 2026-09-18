// GridWise Interactive Smart Microgrid Dashboard Engine

let energyChart = null;
let batteryChart = null;
let currentScenarioData = null;
let sampleCases = [];

// Fallback Sample 1 Data if API is loading
const DEFAULT_SAMPLE_1 = {
  "scenario_id": "SAMPLE-01",
  "label": "Solar cleaning + distractor",
  "operator_notes": [
    "Facilities will wash the rooftop solar panels from noon until 2 PM. During cleaning, usable solar should be treated as roughly 25% of the forecast.",
    "The sports office moved next month's registration deadline."
  ],
  "battery": {
    "capacity_kwh": 220,
    "initial_energy_kwh": 110,
    "minimum_energy_kwh": 40,
    "max_charge_kwh_per_hour": 50,
    "max_discharge_kwh_per_hour": 50
  },
  "hours": [
    {"hour": 0, "demand_kwh": 90, "solar_kwh": 0, "tariff_bdt_per_kwh": 6},
    {"hour": 1, "demand_kwh": 85, "solar_kwh": 0, "tariff_bdt_per_kwh": 6},
    {"hour": 2, "demand_kwh": 80, "solar_kwh": 0, "tariff_bdt_per_kwh": 5},
    {"hour": 3, "demand_kwh": 80, "solar_kwh": 0, "tariff_bdt_per_kwh": 5},
    {"hour": 4, "demand_kwh": 85, "solar_kwh": 0, "tariff_bdt_per_kwh": 5},
    {"hour": 5, "demand_kwh": 95, "solar_kwh": 0, "tariff_bdt_per_kwh": 6},
    {"hour": 6, "demand_kwh": 110, "solar_kwh": 5, "tariff_bdt_per_kwh": 8},
    {"hour": 7, "demand_kwh": 130, "solar_kwh": 20, "tariff_bdt_per_kwh": 10},
    {"hour": 8, "demand_kwh": 150, "solar_kwh": 50, "tariff_bdt_per_kwh": 12},
    {"hour": 9, "demand_kwh": 165, "solar_kwh": 90, "tariff_bdt_per_kwh": 14},
    {"hour": 10, "demand_kwh": 175, "solar_kwh": 130, "tariff_bdt_per_kwh": 16},
    {"hour": 11, "demand_kwh": 180, "solar_kwh": 160, "tariff_bdt_per_kwh": 16},
    {"hour": 12, "demand_kwh": 185, "solar_kwh": 180, "tariff_bdt_per_kwh": 15},
    {"hour": 13, "demand_kwh": 180, "solar_kwh": 170, "tariff_bdt_per_kwh": 14},
    {"hour": 14, "demand_kwh": 170, "solar_kwh": 140, "tariff_bdt_per_kwh": 13},
    {"hour": 15, "demand_kwh": 165, "solar_kwh": 90, "tariff_bdt_per_kwh": 14},
    {"hour": 16, "demand_kwh": 170, "solar_kwh": 45, "tariff_bdt_per_kwh": 18},
    {"hour": 17, "demand_kwh": 185, "solar_kwh": 10, "tariff_bdt_per_kwh": 22},
    {"hour": 18, "demand_kwh": 205, "solar_kwh": 0, "tariff_bdt_per_kwh": 28},
    {"hour": 19, "demand_kwh": 215, "solar_kwh": 0, "tariff_bdt_per_kwh": 30},
    {"hour": 20, "demand_kwh": 205, "solar_kwh": 0, "tariff_bdt_per_kwh": 26},
    {"hour": 21, "demand_kwh": 175, "solar_kwh": 0, "tariff_bdt_per_kwh": 18},
    {"hour": 22, "demand_kwh": 135, "solar_kwh": 0, "tariff_bdt_per_kwh": 10},
    {"hour": 23, "demand_kwh": 105, "solar_kwh": 0, "tariff_bdt_per_kwh": 7}
  ]
};

document.addEventListener('DOMContentLoaded', async () => {
  initCharts();
  await loadSampleCases();
  loadScenario(DEFAULT_SAMPLE_1);
  runOptimization();
  setupEventListeners();
});

// Fetch sample cases from API
async function loadSampleCases() {
  const select = document.getElementById('scenarioSelect');
  try {
    const res = await fetch('/api/sample-cases');
    if (res.ok) {
      sampleCases = await res.json();
      select.innerHTML = '';
      sampleCases.forEach((sc, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${sc.id} — ${sc.label || 'Scenario ' + (idx + 1)}`;
        select.appendChild(opt);
      });
      return;
    }
  } catch (err) {
    console.warn('Using default sample cases:', err);
  }

  // Fallback
  sampleCases = [DEFAULT_SAMPLE_1];
}

function loadScenario(scenario) {
  const data = scenario.input || scenario;
  currentScenarioData = JSON.parse(JSON.stringify(data));
  
  // Fill Battery Fields
  document.getElementById('batteryCapacity').value = data.battery.capacity_kwh;
  document.getElementById('batteryInitial').value = data.battery.initial_energy_kwh;
  document.getElementById('batteryMin').value = data.battery.minimum_energy_kwh;
  document.getElementById('batteryMaxCharge').value = data.battery.max_charge_kwh_per_hour;
  document.getElementById('batteryMaxDischarge').value = data.battery.max_discharge_kwh_per_hour;

  // Fill Operator Notes
  document.getElementById('operatorNotesInput').value = (data.operator_notes || []).join('\n');
}

// Chart.js initialization
function initCharts() {
  const ctxEnergy = document.getElementById('energyChart').getContext('2d');
  const ctxBattery = document.getElementById('batteryChart').getContext('2d');

  const labels = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`);

  energyChart = new Chart(ctxEnergy, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Grid Import',
          data: [],
          backgroundColor: 'rgba(14, 165, 233, 0.75)',
          borderRadius: 4,
          stack: 'source'
        },
        {
          label: 'Solar Used',
          data: [],
          backgroundColor: 'rgba(245, 158, 11, 0.85)',
          borderRadius: 4,
          stack: 'source'
        },
        {
          label: 'Battery Discharge',
          data: [],
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderRadius: 4,
          stack: 'source'
        },
        {
          label: 'Campus Demand',
          data: [],
          type: 'line',
          borderColor: '#f43f5e',
          borderWidth: 2.5,
          pointRadius: 2,
          pointHoverRadius: 5,
          fill: false,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 11 } },
          title: { display: true, text: 'Energy (kWh)', color: '#64748b', font: { size: 11 } }
        }
      }
    }
  });

  batteryChart = new Chart(ctxBattery, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Battery Energy (SOC)',
          data: [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Min Reserve',
          data: [],
          borderColor: 'rgba(244, 63, 94, 0.6)',
          borderWidth: 1.5,
          borderDash: [4, 4],
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'JetBrains Mono', size: 12 }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 11 } },
          title: { display: true, text: 'Energy (kWh)', color: '#64748b', font: { size: 11 } }
        }
      }
    }
  });
}

// Call API & Update Dashboard
async function runOptimization() {
  const btn = document.getElementById('runOptimizeBtn');
  btn.classList.add('loading');
  btn.innerHTML = '<span>⚡ Solving LP Formulation...</span>';

  // Construct request payload
  const rawNotes = document.getElementById('operatorNotesInput').value.trim();
  const notesArray = rawNotes ? rawNotes.split('\n').filter(n => n.trim().length > 0) : [];

  const battery = {
    capacity_kwh: parseFloat(document.getElementById('batteryCapacity').value) || 220,
    initial_energy_kwh: parseFloat(document.getElementById('batteryInitial').value) || 110,
    minimum_energy_kwh: parseFloat(document.getElementById('batteryMin').value) || 40,
    max_charge_kwh_per_hour: parseFloat(document.getElementById('batteryMaxCharge').value) || 50,
    max_discharge_kwh_per_hour: parseFloat(document.getElementById('batteryMaxDischarge').value) || 50
  };

  const payload = {
    scenario_id: currentScenarioData ? currentScenarioData.scenario_id : "CUSTOM-01",
    operator_notes: notesArray,
    hours: (currentScenarioData && currentScenarioData.hours) ? currentScenarioData.hours : DEFAULT_SAMPLE_1.hours,
    battery: battery
  };

  try {
    const res = await fetch('/optimize-energy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || 'Optimization failed with status ' + res.status);
    }

    const data = await res.json();
    renderResults(payload, data);

  } catch (err) {
    alert('Error running optimizer: ' + err.message);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '<span>⚡ Run Optimization Engine</span>';
  }
}

// Render Results across UI
function renderResults(requestPayload, result) {
  // Update KPI Metrics
  document.getElementById('kpiCost').innerText = result.total_cost_bdt.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  document.getElementById('kpiGridKwh').innerText = result.total_grid_kwh.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  document.getElementById('kpiPeakGrid').innerText = result.peak_grid_kwh.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});

  const totalSolarUsed = result.hourly_plan.reduce((sum, h) => sum + h.solar_used_kwh, 0);
  document.getElementById('kpiSolar').innerText = totalSolarUsed.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});

  // Plan summary
  document.getElementById('planSummaryText').innerText = result.plan_summary;

  // Render Directive Interpretation Cards
  const dirContainer = document.getElementById('directivesList');
  dirContainer.innerHTML = '';
  
  if (!result.directive_interpretation || result.directive_interpretation.length === 0) {
    dirContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">No operator directives provided.</p>';
  } else {
    result.directive_interpretation.forEach(d => {
      const card = document.createElement('div');
      card.className = `directive-card ${d.applies ? 'active' : 'noop'}`;

      let adjustmentBadges = '';
      if (d.structured_adjustment) {
        const adj = d.structured_adjustment;
        if (adj.hours && adj.hours.length > 0) {
          adjustmentBadges += `<span class="param-pill">Hours: [${adj.hours.join(', ')}]</span>`;
        }
        if (adj.factor !== null && adj.factor !== undefined) {
          adjustmentBadges += `<span class="param-pill">Factor: ${(adj.factor * 100).toFixed(0)}%</span>`;
        }
        if (adj.minimum_energy_kwh !== null && adj.minimum_energy_kwh !== undefined) {
          adjustmentBadges += `<span class="param-pill">Min Reserve: ${adj.minimum_energy_kwh} kWh</span>`;
        }
        if (adj.max_grid_kwh !== null && adj.max_grid_kwh !== undefined) {
          adjustmentBadges += `<span class="param-pill">Max Grid: ${adj.max_grid_kwh} kWh</span>`;
        }
      }

      card.innerHTML = `
        <div class="directive-top">
          <span class="directive-type">${d.directive_type}</span>
          <span class="directive-tag ${d.applies ? 'tag-active' : 'tag-noop'}">
            ${d.applies ? '● Active' : '○ Ignored (No-op)'}
          </span>
        </div>
        <p class="directive-explanation">${d.explanation || ''}</p>
        <div class="directive-params">${adjustmentBadges}</div>
      `;
      dirContainer.appendChild(card);
    });
  }

  // Update Charts
  const hourly = result.hourly_plan;
  const demands = requestPayload.hours.map(h => h.demand_kwh);
  const gridKwh = hourly.map(h => h.grid_kwh);
  const solarUsed = hourly.map(h => h.solar_used_kwh);
  const discharge = hourly.map(h => h.battery_action === 'discharge' ? h.battery_kwh : 0);
  const batterySoc = hourly.map(h => h.battery_energy_after_kwh);
  const minReserveLine = Array(24).fill(requestPayload.battery.minimum_energy_kwh);

  energyChart.data.datasets[0].data = gridKwh;
  energyChart.data.datasets[1].data = solarUsed;
  energyChart.data.datasets[2].data = discharge;
  energyChart.data.datasets[3].data = demands;
  energyChart.update();

  batteryChart.data.datasets[0].data = batterySoc;
  batteryChart.data.datasets[1].data = minReserveLine;
  batteryChart.update();

  // Populate Schedule Table
  const tableBody = document.getElementById('scheduleTableBody');
  tableBody.innerHTML = '';
  hourly.forEach((h, idx) => {
    const demand = requestPayload.hours[idx] ? requestPayload.hours[idx].demand_kwh : '-';
    const tariff = requestPayload.hours[idx] ? requestPayload.hours[idx].tariff_bdt_per_kwh : '-';
    const row = document.createElement('tr');
    
    let actionBadgeClass = 'action-idle';
    if (h.battery_action === 'charge') actionBadgeClass = 'action-charge';
    if (h.battery_action === 'discharge') actionBadgeClass = 'action-discharge';

    row.innerHTML = `
      <td>${String(h.hour).padStart(2, '0')}:00</td>
      <td>${demand}</td>
      <td>${h.solar_used_kwh.toFixed(1)}</td>
      <td><strong>${h.grid_kwh.toFixed(1)}</strong></td>
      <td>${tariff} ৳</td>
      <td><span class="badge-action ${actionBadgeClass}">${h.battery_action} (${h.battery_kwh.toFixed(1)})</span></td>
      <td>${h.battery_energy_after_kwh.toFixed(1)} kWh</td>
    `;
    tableBody.appendChild(row);
  });

  // Populate Raw JSON Inspector
  document.getElementById('rawJsonCode').textContent = JSON.stringify(result, null, 2);
}

// Setup Event Listeners
function setupEventListeners() {
  // Scenario Dropdown change
  document.getElementById('scenarioSelect').addEventListener('change', (e) => {
    const idx = parseInt(e.target.value);
    if (sampleCases[idx]) {
      loadScenario(sampleCases[idx]);
      runOptimization();
    }
  });

  // Run Optimization Button
  document.getElementById('runOptimizeBtn').addEventListener('click', () => {
    runOptimization();
  });

  // Reset to default button
  document.getElementById('resetBtn').addEventListener('click', () => {
    loadScenario(DEFAULT_SAMPLE_1);
    runOptimization();
  });

  // Chip helpers
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.prompt;
      const input = document.getElementById('operatorNotesInput');
      input.value = (input.value ? input.value + '\n' : '') + text;
      runOptimization();
    });
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.tab;
      if (target === 'table') {
        document.getElementById('tableTabContent').style.display = 'block';
        document.getElementById('jsonTabContent').style.display = 'none';
      } else {
        document.getElementById('tableTabContent').style.display = 'none';
        document.getElementById('jsonTabContent').style.display = 'block';
      }
    });
  });

  // Copy JSON Button
  document.getElementById('copyJsonBtn').addEventListener('click', () => {
    const code = document.getElementById('rawJsonCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('copyJsonBtn');
      const orig = btn.innerText;
      btn.innerText = 'Copied! ✓';
      setTimeout(() => btn.innerText = orig, 1800);
    });
  });
}
