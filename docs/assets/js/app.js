// GitHub OAuth Web Application Flow with Render.com backend
console.log('OAuth Web Flow initialized');

// Configuration
const CONFIG = {
    owner: 'politic-in',
    repo: 'data',
    branch: 'main',
    clientId: 'Ov23liOQQze0fDN4YTW3',
    // Your Render.com backend URL for token exchange
    tokenExchangeUrl: 'https://politic-data-oauth.onrender.com/api/github/token', // Update with your Render URL
    oauthUrl: 'https://github.com/login/oauth/authorize'
};

// Global state
let authToken = null;
let currentUser = null;
let currentTable = null;
let originalData = null;
let editedData = null;
let currentFilePath = null;
let isEditMode = false;

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    console.log('Initializing application...');
    checkAuthentication();
    setupEventListeners();
}

function checkAuthentication() {
    // Check for OAuth callback code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        console.log('OAuth code found, exchanging for token...');
        exchangeCodeForToken(code);
        return;
    }
    
    // Check for stored token
    authToken = localStorage.getItem('github_token');
    if (authToken) {
        console.log('Found stored token, validating...');
        validateAndSetUser();
    }
}

async function exchangeCodeForToken(code) {
    try {
        // Clear the code from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Show loading state
        const authBtn = document.getElementById('authBtn');
        if (authBtn) {
            authBtn.disabled = true;
            authBtn.textContent = 'Authenticating...';
        }
        
        // Exchange code for token using your Heroku backend
        const response = await fetch(CONFIG.tokenExchangeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code })
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        
        const data = await response.json();
        if (data.access_token) {
            authToken = data.access_token;
            localStorage.setItem('github_token', authToken);
            await validateAndSetUser();
        } else {
            throw new Error('No access token received');
        }
    } catch (error) {
        console.error('Token exchange failed:', error);
        alert('Authentication failed. Please try again.');
    } finally {
        updateAuthUI();
    }
}

async function validateAndSetUser() {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Token validation failed');
        }
        
        currentUser = await response.json();
        console.log('Authenticated as:', currentUser.login);
        updateAuthUI();
        
    } catch (error) {
        console.error('Token validation failed:', error);
        logout();
    }
}

function setupEventListeners() {
    // Authentication
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
        authBtn.addEventListener('click', handleAuth);
    }
    
    // Data type selection
    const dataTypeSelect = document.getElementById('dataType');
    if (dataTypeSelect) {
        dataTypeSelect.addEventListener('change', handleDataTypeChange);
    }
    
    // Edit mode
    const editModeBtn = document.getElementById('editModeBtn');
    if (editModeBtn) {
        editModeBtn.addEventListener('click', () => {
            if (typeof toggleEditableMode !== 'undefined') {
                toggleEditableMode();
            } else {
                toggleEditMode();
            }
        });
    }
    
    // Save changes
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', showPRModal);
    }
    
    // Submit PR
    const submitPRBtn = document.getElementById('submitPR');
    if (submitPRBtn) {
        submitPRBtn.addEventListener('click', () => {
            if (typeof createEditablePullRequest !== 'undefined') {
                createEditablePullRequest();
            } else {
                createPullRequest();
            }
        });
    }
}

function handleAuth() {
    if (authToken) {
        logout();
    } else {
        // Redirect to GitHub OAuth
        const redirectUri = window.location.origin + window.location.pathname;
        const scope = 'public_repo'; // or 'repo' for private repos
        const authUrl = `${CONFIG.oauthUrl}?client_id=${CONFIG.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
        window.location.href = authUrl;
    }
}

function logout() {
    localStorage.removeItem('github_token');
    authToken = null;
    currentUser = null;
    isEditMode = false;
    updateAuthUI();
    
    // Hide edit controls
    if (isEditMode) {
        toggleEditMode();
    }
}

function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const userInfo = document.getElementById('userInfo');
    const editBtn = document.getElementById('editModeBtn');
    
    if (authBtn) {
        authBtn.disabled = false;
    }
    
    if (currentUser) {
        if (authBtn) {
            authBtn.textContent = 'Logout';
            authBtn.classList.remove('btn-outline-light');
            authBtn.classList.add('btn-danger');
        }
        if (userInfo) {
            userInfo.textContent = `Logged in as ${currentUser.login}`;
            userInfo.style.display = 'inline';
        }
        if (editBtn && originalData) {
            editBtn.style.display = 'inline-block';
        }
    } else {
        if (authBtn) {
            authBtn.textContent = 'Login to GitHub to Edit';
            authBtn.classList.remove('btn-danger');
            authBtn.classList.add('btn-outline-light');
        }
        if (userInfo) {
            userInfo.style.display = 'none';
        }
        if (editBtn) {
            editBtn.style.display = 'none';
        }
    }
}

// Data Loading
async function handleDataTypeChange(e) {
    const dataType = e.target.value;
    const stateSelect = document.getElementById('stateSelect');
    const fileSelect = document.getElementById('fileSelect');
    
    // Reset
    stateSelect.innerHTML = '<option value="">Select State</option>';
    fileSelect.innerHTML = '<option value="">Select File</option>';
    fileSelect.disabled = true;
    
    document.getElementById('stats').style.display = 'none';
    document.getElementById('dataTable').innerHTML = '';
    originalData = null;
    editedData = null;
    
    if (!dataType) {
        stateSelect.disabled = true;
        return;
    }
    
    try {
        stateSelect.innerHTML = '<option value="">Loading states...</option>';
        stateSelect.disabled = false;
        
        const response = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${dataType}`);
        if (!response.ok) throw new Error('Failed to load states');
        
        const contents = await response.json();
        const states = contents.filter(item => item.type === 'dir').map(item => item.name);
        
        stateSelect.innerHTML = '<option value="">Select State</option>';
        states.forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.textContent = state.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            stateSelect.appendChild(option);
        });
        stateSelect.disabled = false;
        
        stateSelect.onchange = async function() {
            const selectedState = this.value;
            
            if (!selectedState) {
                fileSelect.innerHTML = '<option value="">Select File</option>';
                fileSelect.disabled = true;
                return;
            }
            
            fileSelect.innerHTML = '<option value="">Loading files...</option>';
            
            const filesResponse = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${dataType}/${selectedState}`);
            const filesData = await filesResponse.json();
            const jsonFiles = filesData.filter(item => item.name.endsWith('.json'));
            
            fileSelect.innerHTML = '<option value="">Select File</option>';
            jsonFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.path;
                option.textContent = file.name;
                option.dataset.downloadUrl = file.download_url;
                option.dataset.sha = file.sha;
                fileSelect.appendChild(option);
            });
            fileSelect.disabled = false;
            
            fileSelect.onchange = function() {
                if (this.value) {
                    currentFilePath = this.value;
                    loadData();
                }
            };
        };
    } catch (error) {
        console.error('Error:', error);
        stateSelect.innerHTML = '<option value="">Error loading states</option>';
        stateSelect.disabled = true;
    }
}

async function loadData() {
    const fileSelect = document.getElementById('fileSelect');
    const selectedOption = fileSelect.options[fileSelect.selectedIndex];
    const downloadUrl = selectedOption.dataset.downloadUrl;
    
    const tableContainer = document.getElementById('dataTable');
    tableContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-3">Loading data...</p></div>';
    
    try {
        console.log('Loading from:', downloadUrl);
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        let data = JSON.parse(text);
        console.log('Data type received:', Array.isArray(data) ? 'array' : 'object');
        
        // Determine data type from file path
        const dataType = document.getElementById('dataType').value;
        
        // Handle different data structures
        if (!Array.isArray(data)) {
            if (dataType === 'census') {
                // Census data needs special display with multiple tables
                // Use unified display function for standardized census format
                if (typeof displayCensusDataUnified !== 'undefined') {
                    displayCensusDataUnified(data);
                } else {
                    displayCensusData(data);
                }
                document.getElementById('stats').style.display = 'block';
                document.getElementById('rowCount').textContent = 'Multiple categories';
                
                // Initialize editable data for census
                if (typeof initEditableData !== 'undefined') {
                    initEditableData(data, dataType, currentFilePath, selectedOption.dataset.sha);
                }
                
                return; // Exit early for census
            } else if (dataType === 'election-mla' || dataType === 'election-mp') {
                // Use unified election display function for better visualization
                if (typeof displayElectionDataUnified !== 'undefined') {
                    displayElectionDataUnified(data, dataType);
                    document.getElementById('stats').style.display = 'block';
                    document.getElementById('rowCount').textContent = 'Election data';
                    
                    // Initialize editable data for elections
                    if (typeof initEditableData !== 'undefined') {
                        initEditableData(data, dataType, currentFilePath, selectedOption.dataset.sha);
                    }
                    
                    return; // Exit early for election data
                } else {
                    // Fallback to flattening
                    data = flattenElectionData(data);
                }
            } else if (data.data && Array.isArray(data.data)) {
                // Has a data property that's an array
                data = data.data;
            } else if (data.results && Array.isArray(data.results)) {
                // Has a results property that's an array
                data = data.results;
            } else {
                // Unknown structure - try to display as single row
                data = [data];
            }
        }
        
        console.log('Processed data:', data.length, 'records');
        
        originalData = data;
        editedData = JSON.parse(JSON.stringify(data));
        
        displayDataTable(originalData, false);
        
        document.getElementById('stats').style.display = 'block';
        document.getElementById('rowCount').textContent = originalData.length;
        
        // Initialize editable data for booth/tabular data
        if (typeof initEditableData !== 'undefined') {
            initEditableData(data, dataType, currentFilePath, selectedOption.dataset.sha);
        } else if (authToken) {
            document.getElementById('editModeBtn').style.display = 'inline-block';
        }
    } catch (error) {
        console.error('Failed to load data:', error);
        tableContainer.innerHTML = `<div class="alert alert-danger">Failed to load data: ${error.message}</div>`;
    }
}

// Function to display census data with multiple tables
function displayCensusData(data) {
    const container = document.getElementById('dataTable');
    container.innerHTML = '';
    
    // Create a wrapper div with Bootstrap styling
    const wrapper = document.createElement('div');
    wrapper.className = 'census-data-wrapper';
    
    // Add header with basic info
    if (data.district || data.state) {
        const header = document.createElement('div');
        header.className = 'alert alert-info mb-4';
        header.innerHTML = `
            <h5>${data.district || ''} District, ${data.state || ''}</h5>
            <small>Census Year: ${data.census_year || 2011}</small>
            ${data.source ? `<br><small><a href="${data.source}" target="_blank">Source</a></small>` : ''}
        `;
        wrapper.appendChild(header);
    }
    
    // Create grid layout for tables
    const grid = document.createElement('div');
    grid.className = 'row g-3';
    
    // 1. Population Overview Table
    if (data.population) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        col.innerHTML = `
            <div class="card">
                <div class="card-header bg-primary text-white">
                    <h6 class="mb-0">Population Overview</h6>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <tr><th>Total Population</th><td class="text-end">${(data.population.total || 0).toLocaleString()}</td></tr>
                        <tr><th>Male</th><td class="text-end">${(data.population.male || 0).toLocaleString()}</td></tr>
                        <tr><th>Female</th><td class="text-end">${(data.population.female || 0).toLocaleString()}</td></tr>
                        <tr><th>Sex Ratio</th><td class="text-end">${data.population.sex_ratio || 0}</td></tr>
                    </table>
                </div>
            </div>
        `;
        grid.appendChild(col);
    }
    
    // 2. Area Distribution Table
    if (data.area_distribution) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        let tableHtml = `
            <div class="card">
                <div class="card-header bg-success text-white">
                    <h6 class="mb-0">Area Distribution</h6>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Area</th>
                                <th class="text-end">Population</th>
                                <th class="text-end">%</th>
                                <th class="text-end">Sex Ratio</th>
                            </tr>
                        </thead>
                        <tbody>`;
        
        if (data.area_distribution.urban) {
            const urban = data.area_distribution.urban;
            tableHtml += `
                <tr>
                    <td>Urban</td>
                    <td class="text-end">${(urban.total_population || 0).toLocaleString()}</td>
                    <td class="text-end">${urban.percentage_of_total_population || 0}%</td>
                    <td class="text-end">${urban.sex_ratio || 0}</td>
                </tr>`;
        }
        
        if (data.area_distribution.rural) {
            const rural = data.area_distribution.rural;
            tableHtml += `
                <tr>
                    <td>Rural</td>
                    <td class="text-end">${(rural.total_population || 0).toLocaleString()}</td>
                    <td class="text-end">${rural.percentage_of_total_population || 0}%</td>
                    <td class="text-end">${rural.sex_ratio || 0}</td>
                </tr>`;
        }
        
        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>`;
        col.innerHTML = tableHtml;
        grid.appendChild(col);
    }
    
    // 3. Literacy Table
    if (data.literacy_overall_district || data.literacy || (data.area_distribution && (data.area_distribution.urban?.literacy || data.area_distribution.rural?.literacy))) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        let tableHtml = `
            <div class="card">
                <div class="card-header bg-info text-white">
                    <h6 class="mb-0">Literacy Rates</h6>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th class="text-end">Rate %</th>
                                <th class="text-end">Male %</th>
                                <th class="text-end">Female %</th>
                            </tr>
                        </thead>
                        <tbody>`;
        
        if (data.literacy_overall_district) {
            const lit = data.literacy_overall_district;
            tableHtml += `
                <tr>
                    <td><strong>Overall</strong></td>
                    <td class="text-end"><strong>${lit.rate || 0}%</strong></td>
                    <td class="text-end">${lit.male_rate || 0}%</td>
                    <td class="text-end">${lit.female_rate || 0}%</td>
                </tr>`;
        } else if (data.literacy) {
            // Handle alternate literacy structure (like anantapur.json)
            const lit = data.literacy;
            tableHtml += `
                <tr>
                    <td><strong>Overall</strong></td>
                    <td class="text-end"><strong>${lit.rate_percentage || lit.rate || 0}%</strong></td>
                    <td class="text-end">${lit.male_literacy_rate || lit.male_rate || 0}%</td>
                    <td class="text-end">${lit.female_literacy_rate || lit.female_rate || 0}%</td>
                </tr>`;
        }
        
        if (data.area_distribution?.urban?.literacy) {
            const lit = data.area_distribution.urban.literacy;
            tableHtml += `
                <tr>
                    <td>Urban</td>
                    <td class="text-end">${lit.rate || 0}%</td>
                    <td class="text-end">${lit.male_rate || 0}%</td>
                    <td class="text-end">${lit.female_rate || 0}%</td>
                </tr>`;
        }
        
        if (data.area_distribution?.rural?.literacy) {
            const lit = data.area_distribution.rural.literacy;
            tableHtml += `
                <tr>
                    <td>Rural</td>
                    <td class="text-end">${lit.rate || 0}%</td>
                    <td class="text-end">${lit.male_rate || 0}%</td>
                    <td class="text-end">${lit.female_rate || 0}%</td>
                </tr>`;
        }
        
        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>`;
        col.innerHTML = tableHtml;
        grid.appendChild(col);
    }
    
    // 4. Religion Distribution Table
    if (data.religion_distribution || data.religion) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        let tableHtml = `
            <div class="card">
                <div class="card-header bg-warning">
                    <h6 class="mb-0">Religion Distribution</h6>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Religion</th>
                                <th class="text-end">Population</th>
                                <th class="text-end">%</th>
                            </tr>
                        </thead>
                        <tbody>`;
        
        const religionSource = data.religion_distribution || data.religion;
        Object.keys(religionSource).forEach(religion => {
            const religionData = religionSource[religion];
            if (religionData && religionData.population > 0) {
                tableHtml += `
                    <tr>
                        <td>${religion.charAt(0).toUpperCase() + religion.slice(1).replace(/_/g, ' ')}</td>
                        <td class="text-end">${(religionData.population || 0).toLocaleString()}</td>
                        <td class="text-end">${religionData.percentage || 0}%</td>
                    </tr>`;
            }
        });
        
        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>`;
        col.innerHTML = tableHtml;
        grid.appendChild(col);
    }
    
    // 5. Child Population Table
    if (data.age_groups?.children_0_6_years || data.child_population) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        const children = data.age_groups?.children_0_6_years || data.child_population;
        col.innerHTML = `
            <div class="card">
                <div class="card-header bg-secondary text-white">
                    <h6 class="mb-0">Child Population (0-6 years)</h6>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <tr><th>Total Children</th><td class="text-end">${(children.total || 0).toLocaleString()}</td></tr>
                        <tr><th>Male</th><td class="text-end">${(children.male || 0).toLocaleString()}</td></tr>
                        <tr><th>Female</th><td class="text-end">${(children.female || 0).toLocaleString()}</td></tr>
                        <tr><th>Sex Ratio</th><td class="text-end">${children.sex_ratio || 0}</td></tr>
                        <tr><th>% of Population</th><td class="text-end">${children.percentage_of_total_population || children.percentage_of_total_population_stated || 0}%</td></tr>
                    </table>
                </div>
            </div>
        `;
        grid.appendChild(col);
    }
    
    // 6. Caste Data Table
    if (data.scheduled_caste || data.scheduled_tribe) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        let tableHtml = `
            <div class="card">
                <div class="card-header bg-dark text-white">
                    <h6 class="mb-0">Caste Distribution</h6>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th class="text-end">Population</th>
                                <th class="text-end">%</th>
                            </tr>
                        </thead>
                        <tbody>`;
        
        if (data.scheduled_caste) {
            tableHtml += `
                <tr>
                    <td>Scheduled Caste</td>
                    <td class="text-end">${(data.scheduled_caste.total || 0).toLocaleString()}</td>
                    <td class="text-end">${data.scheduled_caste.percentage || 0}%</td>
                </tr>`;
        }
        
        if (data.scheduled_tribe) {
            tableHtml += `
                <tr>
                    <td>Scheduled Tribe</td>
                    <td class="text-end">${(data.scheduled_tribe.total || 0).toLocaleString()}</td>
                    <td class="text-end">${data.scheduled_tribe.percentage || 0}%</td>
                </tr>`;
        }
        
        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>`;
        col.innerHTML = tableHtml;
        grid.appendChild(col);
    }
    
    // 7. Working Population Table
    if (data.working_population) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        const work = data.working_population;
        col.innerHTML = `
            <div class="card">
                <div class="card-header bg-danger text-white">
                    <h6 class="mb-0">Working Population</h6>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        <tr><th>Total Workers</th><td class="text-end">${(work.total_workers || 0).toLocaleString()}</td></tr>
                        <tr><th>Main Workers</th><td class="text-end">${(work.main_workers || 0).toLocaleString()}</td></tr>
                        <tr><th>Marginal Workers</th><td class="text-end">${(work.marginal_workers || 0).toLocaleString()}</td></tr>
                        <tr><th>Non Workers</th><td class="text-end">${(work.non_workers || 0).toLocaleString()}</td></tr>
                        <tr><th>Worker %</th><td class="text-end">${work.percentage || 0}%</td></tr>
                    </table>
                </div>
            </div>
        `;
        grid.appendChild(col);
    }
    
    wrapper.appendChild(grid);
    container.appendChild(wrapper);
}

// Helper function to flatten census data (keeping for potential future use)
function flattenObjectToArray(obj, type) {
    if (type === 'census') {
        // Create a comprehensive format for census data
        const rows = [];
        
        // Add basic info
        const baseInfo = {
            district: obj.district || '',
            state: obj.state || '',
            census_year: obj.census_year || 2011,
            source: obj.source || ''
        };
        
        // Add overall population data
        if (obj.population) {
            rows.push({
                ...baseInfo,
                category: 'Population',
                subcategory: 'Total',
                total: obj.population.total || 0,
                male: obj.population.male || 0,
                female: obj.population.female || 0,
                sex_ratio: obj.population.sex_ratio || 0,
                percentage: 100
            });
        }
        
        // Add urban population
        if (obj.area_distribution && obj.area_distribution.urban) {
            const urban = obj.area_distribution.urban;
            rows.push({
                ...baseInfo,
                category: 'Population',
                subcategory: 'Urban',
                total: urban.total_population || 0,
                male: urban.male || 0,
                female: urban.female || 0,
                sex_ratio: urban.sex_ratio || 0,
                percentage: urban.percentage_of_total_population || 0
            });
            
            // Urban child population
            if (urban.child_population_0_6) {
                rows.push({
                    ...baseInfo,
                    category: 'Child Population (0-6)',
                    subcategory: 'Urban',
                    total: urban.child_population_0_6.total || 0,
                    male: urban.child_population_0_6.male || 0,
                    female: urban.child_population_0_6.female || 0,
                    sex_ratio: urban.child_population_0_6.sex_ratio || 0,
                    percentage: urban.child_population_0_6.percentage_of_urban_population || 0
                });
            }
            
            // Urban literacy
            if (urban.literacy) {
                rows.push({
                    ...baseInfo,
                    category: 'Literacy',
                    subcategory: 'Urban',
                    total: urban.literacy.total_literates || 0,
                    male: 0,
                    female: 0,
                    literacy_rate: urban.literacy.rate || 0,
                    male_rate: urban.literacy.male_rate || 0,
                    female_rate: urban.literacy.female_rate || 0
                });
            }
        }
        
        // Add rural population
        if (obj.area_distribution && obj.area_distribution.rural) {
            const rural = obj.area_distribution.rural;
            rows.push({
                ...baseInfo,
                category: 'Population',
                subcategory: 'Rural',
                total: rural.total_population || 0,
                male: rural.male || 0,
                female: rural.female || 0,
                sex_ratio: rural.sex_ratio || 0,
                percentage: rural.percentage_of_total_population || 0
            });
            
            // Rural child population
            if (rural.child_population_0_6) {
                rows.push({
                    ...baseInfo,
                    category: 'Child Population (0-6)',
                    subcategory: 'Rural',
                    total: rural.child_population_0_6.total || 0,
                    male: rural.child_population_0_6.male || 0,
                    female: rural.child_population_0_6.female || 0,
                    sex_ratio: rural.child_population_0_6.sex_ratio || 0,
                    percentage: rural.child_population_0_6.percentage_of_rural_population || 0
                });
            }
            
            // Rural literacy
            if (rural.literacy) {
                rows.push({
                    ...baseInfo,
                    category: 'Literacy',
                    subcategory: 'Rural',
                    total: rural.literacy.total_literates || 0,
                    male: 0,
                    female: 0,
                    literacy_rate: rural.literacy.rate || 0,
                    male_rate: rural.literacy.male_rate || 0,
                    female_rate: rural.literacy.female_rate || 0
                });
            }
        }
        
        // Add overall age groups
        if (obj.age_groups && obj.age_groups.children_0_6_years) {
            const children = obj.age_groups.children_0_6_years;
            rows.push({
                ...baseInfo,
                category: 'Child Population (0-6)',
                subcategory: 'Total',
                total: children.total || 0,
                male: children.male || 0,
                female: children.female || 0,
                sex_ratio: children.sex_ratio || 0,
                percentage: children.percentage_of_total_population || 0
            });
        }
        
        // Add overall literacy
        if (obj.literacy_overall_district) {
            const literacy = obj.literacy_overall_district;
            rows.push({
                ...baseInfo,
                category: 'Literacy',
                subcategory: 'Overall District',
                total: literacy.total_literates || 0,
                male: 0,
                female: 0,
                literacy_rate: literacy.rate || 0,
                male_rate: literacy.male_rate || 0,
                female_rate: literacy.female_rate || 0
            });
        }
        
        // Add religion distribution
        if (obj.religion_distribution) {
            Object.keys(obj.religion_distribution).forEach(religion => {
                const religionData = obj.religion_distribution[religion];
                rows.push({
                    ...baseInfo,
                    category: 'Religion',
                    subcategory: religion.charAt(0).toUpperCase() + religion.slice(1).replace(/_/g, ' '),
                    total: religionData.population || 0,
                    percentage: religionData.percentage || 0
                });
            });
        }
        
        // Add caste data if exists
        if (obj.scheduled_caste) {
            rows.push({
                ...baseInfo,
                category: 'Scheduled Caste',
                subcategory: 'Total',
                total: obj.scheduled_caste.total || 0,
                male: obj.scheduled_caste.male || 0,
                female: obj.scheduled_caste.female || 0,
                percentage: obj.scheduled_caste.percentage || 0
            });
        }
        
        if (obj.scheduled_tribe) {
            rows.push({
                ...baseInfo,
                category: 'Scheduled Tribe',
                subcategory: 'Total',
                total: obj.scheduled_tribe.total || 0,
                male: obj.scheduled_tribe.male || 0,
                female: obj.scheduled_tribe.female || 0,
                percentage: obj.scheduled_tribe.percentage || 0
            });
        }
        
        // Add working population if exists
        if (obj.working_population) {
            rows.push({
                ...baseInfo,
                category: 'Working Population',
                subcategory: 'Total Workers',
                total: obj.working_population.total_workers || 0,
                male: obj.working_population.male_workers || 0,
                female: obj.working_population.female_workers || 0,
                percentage: obj.working_population.percentage || 0
            });
            
            if (obj.working_population.main_workers) {
                rows.push({
                    ...baseInfo,
                    category: 'Working Population',
                    subcategory: 'Main Workers',
                    total: obj.working_population.main_workers || 0,
                    percentage: obj.working_population.main_workers_percentage || 0
                });
            }
            
            if (obj.working_population.marginal_workers) {
                rows.push({
                    ...baseInfo,
                    category: 'Working Population',
                    subcategory: 'Marginal Workers',
                    total: obj.working_population.marginal_workers || 0,
                    percentage: obj.working_population.marginal_workers_percentage || 0
                });
            }
        }
        
        return rows.length > 0 ? rows : [obj];
    }
    
    // Default: convert to single row
    return [obj];
}

// Helper function to flatten election data
function flattenElectionData(data) {
    const rows = [];
    
    // Basic info
    const baseInfo = {
        state: data.state || '',
        constituency: data.constituency || '',
        district: data.district || '',
        ac_type: data.ac_type || ''
    };
    
    // Process results by year
    if (data.results) {
        Object.keys(data.results).forEach(year => {
            const yearData = data.results[year];
            
            // Add aggregate row for the year
            if (yearData.aggregate) {
                rows.push({
                    ...baseInfo,
                    year: year,
                    type: 'Aggregate',
                    poll_date: yearData.poll_date || '',
                    counting_date: yearData.counting_date || '',
                    total_electors: yearData.aggregate.total_electors || 0,
                    total_votes_polled: yearData.aggregate.total_votes_polled || 0,
                    turnout_percentage: yearData.aggregate.turnout_percentage || 0,
                    margin_votes: yearData.aggregate.margin_votes || 0,
                    margin_percentage: yearData.aggregate.margin_percentage || 0,
                    total_contestants: yearData.total_contestants || 0
                });
            }
            
            // Add candidate rows
            if (yearData.candidates && Array.isArray(yearData.candidates)) {
                yearData.candidates.forEach((candidate, index) => {
                    rows.push({
                        ...baseInfo,
                        year: year,
                        type: 'Candidate',
                        position: index + 1,
                        candidate_name: candidate.name || candidate.candidate || '',
                        party: candidate.party || '',
                        votes: candidate.votes || 0,
                        vote_percentage: candidate.percentage || candidate.vote_percentage || 0,
                        result: candidate.result || (index === 0 ? 'Winner' : '')
                    });
                });
            }
        });
    }
    
    return rows.length > 0 ? rows : [data];
}

// Table Display
function displayDataTable(data, editable = false) {
    if (!data || data.length === 0) {
        document.getElementById('dataTable').innerHTML = '<div class="alert alert-warning">No data available</div>';
        return;
    }
    
    const columns = Object.keys(data[0]).map(key => ({
        title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        field: key,
        headerFilter: editable ? true : false,
        editor: editable ? "input" : false,
        width: key.length * 10 + 50
    }));
    
    if (editable) {
        columns.unshift({
            formatter: "rowSelection",
            titleFormatter: "rowSelection",
            hozAlign: "center",
            headerSort: false,
            width: 40
        });
    }
    
    currentTable = new Tabulator("#dataTable", {
        data: data,
        columns: columns,
        layout: "fitData",
        pagination: "local",
        paginationSize: 50,
        movableColumns: true,
        resizableColumns: true,
        height: "600px",
        selectable: editable,
        reactiveData: true,
        cellEdited: function(cell) {
            if (editable) {
                const rowData = cell.getRow().getData();
                const rowIndex = cell.getRow().getIndex() - 1;
                editedData[rowIndex] = rowData;
                trackChanges();
            }
        }
    });
}

// Edit Mode
function toggleEditMode() {
    const editBtn = document.getElementById('editModeBtn');
    isEditMode = !isEditMode;
    
    if (isEditMode) {
        editBtn.textContent = 'Cancel Editing';
        editBtn.classList.remove('btn-primary');
        editBtn.classList.add('btn-warning');
        showEditControls();
        displayDataTable(editedData, true);
    } else {
        editBtn.textContent = 'Edit Data';
        editBtn.classList.remove('btn-warning');
        editBtn.classList.add('btn-primary');
        hideEditControls();
        editedData = JSON.parse(JSON.stringify(originalData));
        displayDataTable(originalData, false);
    }
}

function showEditControls() {
    let controls = document.getElementById('editControls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'editControls';
        controls.className = 'mb-3';
        controls.innerHTML = `
            <div class="btn-group" role="group">
                <button id="addRowBtn" class="btn btn-success btn-sm">➕ Add Row</button>
                <button id="deleteRowBtn" class="btn btn-danger btn-sm">🗑️ Delete Selected</button>
                <button id="undoChangesBtn" class="btn btn-secondary btn-sm">↩️ Undo All</button>
            </div>
            <span id="changeCount" class="ms-3 text-muted"></span>
        `;
        document.getElementById('dataTable').parentNode.insertBefore(controls, document.getElementById('dataTable'));
        
        document.getElementById('addRowBtn').addEventListener('click', addRow);
        document.getElementById('deleteRowBtn').addEventListener('click', deleteSelectedRows);
        document.getElementById('undoChangesBtn').addEventListener('click', undoAllChanges);
    }
    controls.style.display = 'block';
    document.getElementById('saveChangesBtn').style.display = 'inline-block';
    trackChanges();
}

function hideEditControls() {
    const controls = document.getElementById('editControls');
    if (controls) {
        controls.style.display = 'none';
    }
    document.getElementById('saveChangesBtn').style.display = 'none';
}

function addRow() {
    const newRow = {};
    if (editedData.length > 0) {
        Object.keys(editedData[0]).forEach(key => {
            newRow[key] = typeof editedData[0][key] === 'number' ? 0 : '';
        });
    }
    currentTable.addRow(newRow);
    editedData.push(newRow);
    trackChanges();
}

function deleteSelectedRows() {
    const selectedData = currentTable.getSelectedData();
    if (selectedData.length === 0) {
        alert('Please select rows to delete');
        return;
    }
    
    if (confirm(`Delete ${selectedData.length} selected rows?`)) {
        currentTable.getSelectedRows().forEach(row => row.delete());
        editedData = currentTable.getData();
        trackChanges();
    }
}

function undoAllChanges() {
    if (confirm('Undo all changes?')) {
        editedData = JSON.parse(JSON.stringify(originalData));
        displayDataTable(editedData, true);
        trackChanges();
    }
}

function trackChanges() {
    const changes = calculateChanges();
    const changeCount = document.getElementById('changeCount');
    if (changeCount) {
        changeCount.textContent = `${changes.added} added, ${changes.modified} modified, ${changes.deleted} deleted`;
    }
    
    const saveBtn = document.getElementById('saveChangesBtn');
    if (saveBtn) {
        saveBtn.disabled = changes.total === 0;
    }
}

function calculateChanges() {
    const tableData = currentTable ? currentTable.getData() : editedData;
    let added = 0, modified = 0, deleted = 0;
    
    if (tableData.length > originalData.length) {
        added = tableData.length - originalData.length;
    } else if (tableData.length < originalData.length) {
        deleted = originalData.length - tableData.length;
    }
    
    const minLength = Math.min(tableData.length, originalData.length);
    for (let i = 0; i < minLength; i++) {
        if (JSON.stringify(tableData[i]) !== JSON.stringify(originalData[i])) {
            modified++;
        }
    }
    
    return { added, modified, deleted, total: added + modified + deleted };
}

// Pull Request
function showPRModal() {
    const modal = new bootstrap.Modal(document.getElementById('prModal'));
    const changes = calculateChanges();
    
    document.getElementById('prTitle').value = `Update ${currentFilePath}`;
    document.getElementById('prDescription').value = `Changes:\n- Added: ${changes.added} rows\n- Modified: ${changes.modified} rows\n- Deleted: ${changes.deleted} rows`;
    
    modal.show();
}

async function createPullRequest() {
    const title = document.getElementById('prTitle').value;
    const description = document.getElementById('prDescription').value;
    
    if (!title) {
        alert('Please provide a title');
        return;
    }
    
    const submitBtn = document.getElementById('submitPR');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating PR...';
    
    try {
        const tableData = currentTable.getData();
        const pr = await createGitHubPR(title, description, tableData);
        
        alert(`Pull Request created!\nPR #${pr.number}\nView at: ${pr.html_url}`);
        
        bootstrap.Modal.getInstance(document.getElementById('prModal')).hide();
        toggleEditMode();
        
    } catch (error) {
        console.error('Failed to create PR:', error);
        alert(`Failed to create PR: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Pull Request';
    }
}

async function createGitHubPR(title, description, newData) {
    // Get file SHA
    const fileSelect = document.getElementById('fileSelect');
    const selectedOption = fileSelect.options[fileSelect.selectedIndex];
    const fileSha = selectedOption.dataset.sha;
    
    // Create or get fork
    const forkResponse = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/forks`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    let fork;
    if (forkResponse.ok) {
        fork = await forkResponse.json();
    } else {
        // Fork exists, find it
        const reposResponse = await fetch(`https://api.github.com/user/repos?per_page=100`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const repos = await reposResponse.json();
        fork = repos.find(r => r.fork && r.parent && r.parent.full_name === `${CONFIG.owner}/${CONFIG.repo}`);
        
        if (!fork) throw new Error('Failed to create or find fork');
    }
    
    // Wait for fork
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create branch
    const branchName = `update-${Date.now()}`;
    
    const refResponse = await fetch(`https://api.github.com/repos/${currentUser.login}/${fork.name}/git/ref/heads/${CONFIG.branch}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    
    const ref = await refResponse.json();
    
    await fetch(`https://api.github.com/repos/${currentUser.login}/${fork.name}/git/refs`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: ref.object.sha
        })
    });
    
    // Update file
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(newData, null, 2))));
    
    await fetch(`https://api.github.com/repos/${currentUser.login}/${fork.name}/contents/${currentFilePath}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: title,
            content: content,
            sha: fileSha,
            branch: branchName
        })
    });
    
    // Create PR
    const prResponse = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/pulls`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: title,
            body: description,
            head: `${currentUser.login}:${branchName}`,
            base: CONFIG.branch
        })
    });
    
    if (!prResponse.ok) {
        const error = await prResponse.json();
        throw new Error(error.message || 'Failed to create pull request');
    }
    
    return await prResponse.json();
}