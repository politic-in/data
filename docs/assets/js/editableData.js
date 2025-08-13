// Unified editable data system for all data types
// Supports booth, census, election-mla, and election-mp data editing

let editableOriginalData = null;
let editableCurrentData = null;
let editableDataType = null;
let editableFilePath = null;
let editableFileSha = null;
let isInEditMode = false;

// Initialize editable data system
function initEditableData(data, dataType, filePath, fileSha) {
    editableOriginalData = JSON.parse(JSON.stringify(data));
    editableCurrentData = JSON.parse(JSON.stringify(data));
    editableDataType = dataType;
    editableFilePath = filePath;
    editableFileSha = fileSha;
    
    // Enable edit button if authenticated
    if (window.authToken) {
        const editBtn = document.getElementById('editModeBtn');
        if (editBtn) {
            editBtn.style.display = 'inline-block';
            editBtn.disabled = false;
        }
    }
}

// Toggle edit mode
function toggleEditableMode() {
    isInEditMode = !isInEditMode;
    const editBtn = document.getElementById('editModeBtn');
    
    if (isInEditMode) {
        editBtn.textContent = 'Cancel Editing';
        editBtn.classList.remove('btn-primary');
        editBtn.classList.add('btn-warning');
        enterEditMode();
    } else {
        editBtn.textContent = 'Edit Data';
        editBtn.classList.remove('btn-warning');
        editBtn.classList.add('btn-primary');
        exitEditMode();
    }
}

// Enter edit mode
function enterEditMode() {
    const container = document.getElementById('dataTable');
    
    // Clear current display to replace with editable version
    if (container) {
        container.innerHTML = '';
    }
    
    // Add edit controls
    showEditControls();
    
    // Make data editable based on type
    switch(editableDataType) {
        case 'census':
            makeCensusEditable();
            break;
        case 'election-mla':
            makeElectionMLAEditable();
            break;
        case 'election-mp':
            makeElectionMPEditable();
            break;
        default:
            makeTableEditable();
    }
}

// Exit edit mode
function exitEditMode() {
    hideEditControls();
    
    // Restore original display
    editableCurrentData = JSON.parse(JSON.stringify(editableOriginalData));
    
    // Re-display data
    switch(editableDataType) {
        case 'census':
            if (typeof displayCensusDataUnified !== 'undefined') {
                displayCensusDataUnified(editableOriginalData);
            }
            break;
        case 'election-mla':
        case 'election-mp':
            if (typeof displayElectionDataUnified !== 'undefined') {
                displayElectionDataUnified(editableOriginalData, editableDataType);
            }
            break;
        default:
            if (typeof displayDataTable !== 'undefined') {
                displayDataTable(editableOriginalData, false);
            }
    }
}

// Make census data editable
function makeCensusEditable() {
    const container = document.getElementById('dataTable');
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'census-edit-wrapper';
    
    // Create editable form for census data
    const form = document.createElement('form');
    form.className = 'row g-3';
    form.innerHTML = `
        <h5>Edit Census Data</h5>
        
        <!-- Basic Info -->
        <div class="col-md-6">
            <div class="card">
                <div class="card-header bg-primary text-white">Basic Information</div>
                <div class="card-body">
                    <div class="mb-2">
                        <label class="form-label">District</label>
                        <input type="text" class="form-control" id="edit_district" value="${editableCurrentData.district || ''}">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">State</label>
                        <input type="text" class="form-control" id="edit_state" value="${editableCurrentData.state || ''}">
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Population -->
        <div class="col-md-6">
            <div class="card">
                <div class="card-header bg-success text-white">Population</div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-6 mb-2">
                            <label class="form-label">Total</label>
                            <input type="number" class="form-control" id="edit_pop_total" 
                                   value="${editableCurrentData.population?.total || 0}">
                        </div>
                        <div class="col-6 mb-2">
                            <label class="form-label">Male</label>
                            <input type="number" class="form-control" id="edit_pop_male" 
                                   value="${editableCurrentData.population?.male || 0}">
                        </div>
                        <div class="col-6 mb-2">
                            <label class="form-label">Female</label>
                            <input type="number" class="form-control" id="edit_pop_female" 
                                   value="${editableCurrentData.population?.female || 0}">
                        </div>
                        <div class="col-6 mb-2">
                            <label class="form-label">Sex Ratio</label>
                            <input type="number" class="form-control" id="edit_pop_sex_ratio" 
                                   value="${editableCurrentData.population?.sex_ratio || 0}">
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Literacy -->
        <div class="col-md-6">
            <div class="card">
                <div class="card-header bg-info text-white">Literacy</div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-6 mb-2">
                            <label class="form-label">Rate %</label>
                            <input type="number" step="0.01" class="form-control" id="edit_lit_rate" 
                                   value="${editableCurrentData.literacy?.rate_percentage || 0}">
                        </div>
                        <div class="col-6 mb-2">
                            <label class="form-label">Total Literate</label>
                            <input type="number" class="form-control" id="edit_lit_total" 
                                   value="${editableCurrentData.literacy?.total_literate || 0}">
                        </div>
                        <div class="col-6 mb-2">
                            <label class="form-label">Male Rate %</label>
                            <input type="number" step="0.01" class="form-control" id="edit_lit_male_rate" 
                                   value="${editableCurrentData.literacy?.male_literacy_rate || 0}">
                        </div>
                        <div class="col-6 mb-2">
                            <label class="form-label">Female Rate %</label>
                            <input type="number" step="0.01" class="form-control" id="edit_lit_female_rate" 
                                   value="${editableCurrentData.literacy?.female_literacy_rate || 0}">
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Add more sections as needed -->
    `;
    
    // Add change listeners
    form.addEventListener('input', () => {
        updateCensusData();
        trackEditableChanges();
    });
    
    wrapper.appendChild(form);
    container.appendChild(wrapper);
}

// Make election MLA data editable
function makeElectionMLAEditable() {
    const container = document.getElementById('dataTable');
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'election-edit-wrapper';
    
    // Create year selector
    const yearSelector = document.createElement('div');
    yearSelector.className = 'mb-3';
    yearSelector.innerHTML = `
        <label class="form-label">Select Year to Edit</label>
        <select class="form-select" id="editYearSelect">
            ${Object.keys(editableCurrentData.results || {}).map(year => 
                `<option value="${year}">${year}</option>`
            ).join('')}
        </select>
    `;
    wrapper.appendChild(yearSelector);
    
    // Create edit area
    const editArea = document.createElement('div');
    editArea.id = 'electionEditArea';
    wrapper.appendChild(editArea);
    
    // Load first year
    const firstYear = Object.keys(editableCurrentData.results || {})[0];
    if (firstYear) {
        loadElectionYearForEdit(firstYear);
    }
    
    // Add year change listener
    document.getElementById('editYearSelect').addEventListener('change', (e) => {
        loadElectionYearForEdit(e.target.value);
    });
    
    container.appendChild(wrapper);
}

// Make election MP data editable
function makeElectionMPEditable() {
    const container = document.getElementById('dataTable');
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'election-mp-edit-wrapper';
    
    // Check if it's winners report format
    if (editableCurrentData.full_loksabha_winners_details) {
        // Create editable table for MP winners
        createEditableMPWinnersTable(wrapper);
    } else if (editableCurrentData.results) {
        // Use same format as MLA for constituency results
        makeElectionMLAEditable();
        return;
    }
    
    container.appendChild(wrapper);
}

// Create editable MP winners table
function createEditableMPWinnersTable(wrapper) {
    const winners = editableCurrentData.full_loksabha_winners_details || [];
    
    wrapper.innerHTML = `
        <h5>Edit MP Winners Data</h5>
        <div class="table-responsive">
            <table class="table table-sm" id="mpEditTable">
                <thead>
                    <tr>
                        <th>Constituency</th>
                        <th>Candidate</th>
                        <th>Party</th>
                        <th>Education</th>
                        <th>Assets (₹)</th>
                        <th>Liabilities (₹)</th>
                        <th>Criminal Cases</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${winners.map((winner, idx) => `
                        <tr data-index="${idx}">
                            <td><input type="text" class="form-control form-control-sm" value="${winner.constituency || ''}" data-field="constituency"></td>
                            <td><input type="text" class="form-control form-control-sm" value="${winner.candidate_name || ''}" data-field="candidate_name"></td>
                            <td><input type="text" class="form-control form-control-sm" value="${winner.party || ''}" data-field="party"></td>
                            <td><input type="text" class="form-control form-control-sm" value="${winner.education || ''}" data-field="education"></td>
                            <td><input type="number" class="form-control form-control-sm" value="${winner.total_assets_rs || 0}" data-field="total_assets_rs"></td>
                            <td><input type="number" class="form-control form-control-sm" value="${winner.liabilities_rs || 0}" data-field="liabilities_rs"></td>
                            <td><input type="number" class="form-control form-control-sm" value="${winner.total_no_of_cases || 0}" data-field="total_no_of_cases"></td>
                            <td><button class="btn btn-sm btn-danger" onclick="removeMPWinner(${idx})">×</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <button class="btn btn-sm btn-success mt-2" onclick="addMPWinner()">Add Winner</button>
    `;
    
    // Add input listeners
    wrapper.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', (e) => {
            const row = e.target.closest('tr');
            const index = parseInt(row.dataset.index);
            const field = e.target.dataset.field;
            const value = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
            
            if (editableCurrentData.full_loksabha_winners_details[index]) {
                editableCurrentData.full_loksabha_winners_details[index][field] = value;
                trackEditableChanges();
            }
        });
    });
}

// Load election year data for editing
function loadElectionYearForEdit(year) {
    const editArea = document.getElementById('electionEditArea');
    const yearData = editableCurrentData.results[year];
    
    if (!yearData) return;
    
    editArea.innerHTML = `
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h5>Edit ${year} Election Data</h5>
            </div>
            <div class="card-body">
                <!-- Aggregate Data -->
                <h6>Aggregate Data</h6>
                <div class="row mb-3">
                    <div class="col-md-3">
                        <label>Total Electors</label>
                        <input type="number" class="form-control" id="edit_${year}_electors" 
                               value="${yearData.aggregate?.total_electors || 0}">
                    </div>
                    <div class="col-md-3">
                        <label>Votes Polled</label>
                        <input type="number" class="form-control" id="edit_${year}_votes" 
                               value="${yearData.aggregate?.total_votes_polled || 0}">
                    </div>
                    <div class="col-md-3">
                        <label>Turnout %</label>
                        <input type="number" step="0.1" class="form-control" id="edit_${year}_turnout" 
                               value="${yearData.aggregate?.turnout_percentage || 0}">
                    </div>
                    <div class="col-md-3">
                        <label>Margin Votes</label>
                        <input type="number" class="form-control" id="edit_${year}_margin" 
                               value="${yearData.aggregate?.margin_votes || 0}">
                    </div>
                </div>
                
                <!-- Candidates -->
                <h6>Candidates</h6>
                <div id="candidates_${year}">
                    ${yearData.candidates?.map((candidate, idx) => `
                        <div class="row mb-2 candidate-row" data-year="${year}" data-index="${idx}">
                            <div class="col-md-1">
                                <input type="number" class="form-control" placeholder="Pos" 
                                       value="${candidate.position || idx + 1}">
                            </div>
                            <div class="col-md-3">
                                <input type="text" class="form-control" placeholder="Name" 
                                       value="${candidate.name || ''}">
                            </div>
                            <div class="col-md-3">
                                <input type="text" class="form-control" placeholder="Party" 
                                       value="${candidate.party || ''}">
                            </div>
                            <div class="col-md-2">
                                <input type="number" class="form-control" placeholder="Votes" 
                                       value="${candidate.votes || 0}">
                            </div>
                            <div class="col-md-2">
                                <input type="number" step="0.1" class="form-control" placeholder="%" 
                                       value="${candidate.votes_percentage || 0}">
                            </div>
                            <div class="col-md-1">
                                <button class="btn btn-sm btn-danger" onclick="removeCandidate('${year}', ${idx})">×</button>
                            </div>
                        </div>
                    `).join('') || ''}
                </div>
                <button class="btn btn-sm btn-success mt-2" onclick="addCandidate('${year}')">Add Candidate</button>
            </div>
        </div>
    `;
    
    // Add input listeners
    editArea.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            updateElectionData(year);
            trackEditableChanges();
        });
    });
}

// Update census data from form
function updateCensusData() {
    editableCurrentData.district = document.getElementById('edit_district').value;
    editableCurrentData.state = document.getElementById('edit_state').value;
    
    if (!editableCurrentData.population) editableCurrentData.population = {};
    editableCurrentData.population.total = parseInt(document.getElementById('edit_pop_total').value) || 0;
    editableCurrentData.population.male = parseInt(document.getElementById('edit_pop_male').value) || 0;
    editableCurrentData.population.female = parseInt(document.getElementById('edit_pop_female').value) || 0;
    editableCurrentData.population.sex_ratio = parseInt(document.getElementById('edit_pop_sex_ratio').value) || 0;
    
    if (!editableCurrentData.literacy) editableCurrentData.literacy = {};
    editableCurrentData.literacy.rate_percentage = parseFloat(document.getElementById('edit_lit_rate').value) || 0;
    editableCurrentData.literacy.total_literate = parseInt(document.getElementById('edit_lit_total').value) || 0;
    editableCurrentData.literacy.male_literacy_rate = parseFloat(document.getElementById('edit_lit_male_rate').value) || 0;
    editableCurrentData.literacy.female_literacy_rate = parseFloat(document.getElementById('edit_lit_female_rate').value) || 0;
}

// Update election data from form
function updateElectionData(year) {
    const yearData = editableCurrentData.results[year];
    
    // Update aggregate
    if (!yearData.aggregate) yearData.aggregate = {};
    yearData.aggregate.total_electors = parseInt(document.getElementById(`edit_${year}_electors`).value) || 0;
    yearData.aggregate.total_votes_polled = parseInt(document.getElementById(`edit_${year}_votes`).value) || 0;
    yearData.aggregate.turnout_percentage = parseFloat(document.getElementById(`edit_${year}_turnout`).value) || 0;
    yearData.aggregate.margin_votes = parseInt(document.getElementById(`edit_${year}_margin`).value) || 0;
    
    // Update candidates
    const candidateRows = document.querySelectorAll(`.candidate-row[data-year="${year}"]`);
    yearData.candidates = [];
    
    candidateRows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        yearData.candidates.push({
            position: parseInt(inputs[0].value) || 0,
            name: inputs[1].value,
            party: inputs[2].value,
            votes: parseInt(inputs[3].value) || 0,
            votes_percentage: parseFloat(inputs[4].value) || 0
        });
    });
}

// Add candidate
function addCandidate(year) {
    const yearData = editableCurrentData.results[year];
    if (!yearData.candidates) yearData.candidates = [];
    
    yearData.candidates.push({
        position: yearData.candidates.length + 1,
        name: '',
        party: '',
        votes: 0,
        votes_percentage: 0
    });
    
    loadElectionYearForEdit(year);
}

// Remove candidate
function removeCandidate(year, index) {
    const yearData = editableCurrentData.results[year];
    if (yearData.candidates) {
        yearData.candidates.splice(index, 1);
        loadElectionYearForEdit(year);
    }
}

// Add MP winner
function addMPWinner() {
    if (!editableCurrentData.full_loksabha_winners_details) {
        editableCurrentData.full_loksabha_winners_details = [];
    }
    
    editableCurrentData.full_loksabha_winners_details.push({
        constituency: '',
        candidate_name: '',
        party: '',
        education: '',
        total_assets_rs: 0,
        liabilities_rs: 0,
        total_no_of_cases: 0
    });
    
    makeElectionMPEditable();
}

// Remove MP winner
function removeMPWinner(index) {
    if (editableCurrentData.full_loksabha_winners_details) {
        editableCurrentData.full_loksabha_winners_details.splice(index, 1);
        makeElectionMPEditable();
    }
}

// Make table editable (for booth data)
function makeTableEditable() {
    if (typeof displayDataTable !== 'undefined') {
        // For booth data, we need to use the global table functionality
        window.originalData = editableCurrentData;
        window.editedData = JSON.parse(JSON.stringify(editableCurrentData));
        displayDataTable(editableCurrentData, true);
        
        // Override the global data change tracking
        const originalOnCellEdited = window.onCellEdited;
        window.onCellEdited = function(cell) {
            if (originalOnCellEdited) {
                originalOnCellEdited(cell);
            }
            // Update our editable data
            const rowIndex = cell.getRow().getIndex() - 1;
            const field = cell.getField();
            const value = cell.getValue();
            if (editableCurrentData[rowIndex]) {
                editableCurrentData[rowIndex][field] = value;
                trackEditableChanges();
            }
        };
    }
}

// Show edit controls
function showEditControls() {
    let controls = document.getElementById('editControls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'editControls';
        controls.className = 'alert alert-warning mb-3';
        controls.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <strong>Edit Mode:</strong> 
                    <span id="changeCount">No changes yet</span>
                </div>
                <div>
                    <button class="btn btn-sm btn-secondary" id="undoAllBtn">Undo All</button>
                    <button class="btn btn-sm btn-success" id="saveChangesBtn">Save Changes</button>
                </div>
            </div>
        `;
        
        const container = document.getElementById('dataTable');
        container.parentNode.insertBefore(controls, container);
        
        // Add event listeners
        document.getElementById('undoAllBtn').addEventListener('click', undoAllChanges);
        document.getElementById('saveChangesBtn').addEventListener('click', saveEditableChanges);
    }
    
    controls.style.display = 'block';
}

// Hide edit controls
function hideEditControls() {
    const controls = document.getElementById('editControls');
    if (controls) {
        controls.style.display = 'none';
    }
}

// Track changes
function trackEditableChanges() {
    const changes = calculateEditableChanges();
    const changeCount = document.getElementById('changeCount');
    if (changeCount) {
        if (changes.hasChanges) {
            changeCount.textContent = 'Data has been modified';
            changeCount.className = 'text-danger';
        } else {
            changeCount.textContent = 'No changes yet';
            changeCount.className = '';
        }
    }
}

// Calculate changes
function calculateEditableChanges() {
    const original = JSON.stringify(editableOriginalData);
    const current = JSON.stringify(editableCurrentData);
    return {
        hasChanges: original !== current
    };
}

// Undo all changes
function undoAllChanges() {
    if (confirm('Undo all changes?')) {
        editableCurrentData = JSON.parse(JSON.stringify(editableOriginalData));
        enterEditMode(); // Refresh display
    }
}

// Save changes
async function saveEditableChanges() {
    const changes = calculateEditableChanges();
    if (!changes.hasChanges) {
        alert('No changes to save');
        return;
    }
    
    // Show PR modal
    showEditablePRModal();
}

// Show PR modal
function showEditablePRModal() {
    const modal = new bootstrap.Modal(document.getElementById('prModal'));
    
    document.getElementById('prTitle').value = `Update ${editableFilePath}`;
    document.getElementById('prDescription').value = `Updated ${editableDataType} data for ${editableFilePath}`;
    
    modal.show();
}

// Create pull request with editable data
async function createEditablePullRequest() {
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
        // Create or get fork
        const forkResponse = await fetch(`https://api.github.com/repos/${window.CONFIG.owner}/${window.CONFIG.repo}/forks`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.authToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        let fork;
        if (forkResponse.ok) {
            fork = await forkResponse.json();
        } else {
            // Fork might already exist, find it
            const reposResponse = await fetch(`https://api.github.com/user/repos?per_page=100`, {
                headers: {
                    'Authorization': `Bearer ${window.authToken}`
                }
            });
            const repos = await reposResponse.json();
            fork = repos.find(r => r.fork && r.parent && r.parent.full_name === `${window.CONFIG.owner}/${window.CONFIG.repo}`);
            
            if (!fork) throw new Error('Failed to create or find fork');
        }
        
        // Wait a bit for fork to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create branch
        const branchName = `update-${Date.now()}`;
        
        // Get main branch ref
        const refResponse = await fetch(`https://api.github.com/repos/${fork.owner.login}/${fork.name}/git/ref/heads/${window.CONFIG.branch}`, {
            headers: {
                'Authorization': `Bearer ${window.authToken}`
            }
        });
        
        if (!refResponse.ok) {
            throw new Error('Failed to get main branch reference');
        }
        
        const ref = await refResponse.json();
        
        // Create new branch
        const newBranchResponse = await fetch(`https://api.github.com/repos/${fork.owner.login}/${fork.name}/git/refs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: `refs/heads/${branchName}`,
                sha: ref.object.sha
            })
        });
        
        if (!newBranchResponse.ok) {
            throw new Error('Failed to create branch');
        }
        
        // Prepare content - use modern approach instead of deprecated unescape
        const jsonString = JSON.stringify(editableCurrentData, null, 2);
        const encoder = new TextEncoder();
        const data = encoder.encode(jsonString);
        const content = btoa(String.fromCharCode(...data));
        
        // Update file
        const updateResponse = await fetch(`https://api.github.com/repos/${fork.owner.login}/${fork.name}/contents/${editableFilePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${window.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: title,
                content: content,
                sha: editableFileSha,
                branch: branchName
            })
        });
        
        if (!updateResponse.ok) {
            const error = await updateResponse.json();
            throw new Error(error.message || 'Failed to update file');
        }
        
        // Create pull request
        const prResponse = await fetch(`https://api.github.com/repos/${window.CONFIG.owner}/${window.CONFIG.repo}/pulls`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                body: description,
                head: `${fork.owner.login}:${branchName}`,
                base: CONFIG.branch
            })
        });
        
        if (!prResponse.ok) {
            const error = await prResponse.json();
            throw new Error(error.message || 'Failed to create pull request');
        }
        
        const pr = await prResponse.json();
        
        alert(`Pull Request created successfully!\nPR #${pr.number}\nView at: ${pr.html_url}`);
        
        // Close modal and exit edit mode
        bootstrap.Modal.getInstance(document.getElementById('prModal')).hide();
        toggleEditableMode();
        
    } catch (error) {
        console.error('Failed to create PR:', error);
        alert(`Failed to create PR: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Pull Request';
    }
}

// Make functions globally available
window.initEditableData = initEditableData;
window.toggleEditableMode = toggleEditableMode;
window.createEditablePullRequest = createEditablePullRequest;
window.addCandidate = addCandidate;
window.removeCandidate = removeCandidate;
window.addMPWinner = addMPWinner;
window.removeMPWinner = removeMPWinner;

// Export functions if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initEditableData,
        toggleEditableMode,
        createEditablePullRequest,
        addCandidate,
        removeCandidate,
        addMPWinner,
        removeMPWinner
    };
}