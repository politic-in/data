// Unified election data display functions for MLA and MP elections
// Provides visual timeline-based display instead of flattened tables

// Display MLA Election Data (constituency results over years)
function displayElectionMLAData(data) {
    const container = document.getElementById('dataTable');
    container.innerHTML = '';
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'election-mla-wrapper';
    
    // Add constituency header
    const header = document.createElement('div');
    header.className = 'alert alert-primary mb-4';
    header.innerHTML = `
        <h4>${data.constituency || 'Unknown'} Constituency</h4>
        <div class="row">
            <div class="col-md-3"><strong>State:</strong> ${data.state || 'N/A'}</div>
            <div class="col-md-3"><strong>District:</strong> ${data.district || 'N/A'}</div>
            <div class="col-md-3"><strong>Type:</strong> ${data.ac_type || 'GEN'}</div>
            <div class="col-md-3"><strong>Elections:</strong> ${data.results ? Object.keys(data.results).length : 0}</div>
        </div>
    `;
    wrapper.appendChild(header);
    
    // Process and display results by year
    if (data.results) {
        // Sort years in descending order (most recent first)
        const years = Object.keys(data.results).sort((a, b) => parseInt(b) - parseInt(a));
        
        // Create timeline container
        const timeline = document.createElement('div');
        timeline.className = 'election-timeline';
        
        years.forEach(year => {
            const yearData = data.results[year];
            const yearCard = createYearCard(year, yearData, data.constituency);
            timeline.appendChild(yearCard);
        });
        
        wrapper.appendChild(timeline);
    }
    
    container.appendChild(wrapper);
}

// Create a card for each election year
function createYearCard(year, yearData, constituency) {
    const card = document.createElement('div');
    card.className = 'card mb-4';
    
    // Determine winner and runner-up
    const winner = yearData.candidates && yearData.candidates[0];
    const runnerUp = yearData.candidates && yearData.candidates[1];
    const marginPercent = yearData.aggregate?.margin_percentage || 0;
    
    // Color code based on winning party
    const partyColors = {
        'BJP': '#ff9933',
        'Indian National Congress': '#19aaed',
        'INC': '#19aaed',
        'Telugu Desam': '#fcde00',
        'TDP': '#fcde00',
        'YSRCP': '#1e5e00',
        'YSR Congress Party': '#1e5e00',
        'CPI(M)': '#ff1111',
        'CPI': '#ff1111',
        'AITC': '#20c646',
        'All India Trinamool Congress': '#20c646',
        'DMK': '#dd0000',
        'AIADMK': '#139b00'
    };
    
    const winnerPartyColor = winner ? (partyColors[winner.party] || '#6c757d') : '#6c757d';
    
    card.innerHTML = `
        <div class="card-header" style="background: linear-gradient(to right, ${winnerPartyColor}22, white);">
            <div class="row align-items-center">
                <div class="col-md-2">
                    <h3 class="mb-0">${year}</h3>
                </div>
                <div class="col-md-4">
                    <small class="text-muted">
                        ${yearData.poll_date ? `Poll: ${yearData.poll_date}` : ''}
                        ${yearData.counting_date ? `<br>Count: ${yearData.counting_date}` : ''}
                    </small>
                </div>
                <div class="col-md-3">
                    <strong>Turnout:</strong> ${yearData.aggregate?.turnout_percentage || 0}%
                    <div class="progress" style="height: 10px;">
                        <div class="progress-bar bg-success" style="width: ${yearData.aggregate?.turnout_percentage || 0}%"></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <strong>Total Votes:</strong> ${(yearData.aggregate?.total_votes_polled || 0).toLocaleString()}
                    <br>
                    <small class="text-muted">out of ${(yearData.aggregate?.total_electors || 0).toLocaleString()} electors</small>
                </div>
            </div>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    ${createCandidatesTable(yearData.candidates, yearData.aggregate?.total_votes_polled)}
                </div>
                <div class="col-md-6">
                    ${createResultsSummary(winner, runnerUp, marginPercent, yearData)}
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// Create candidates table with vote share visualization
function createCandidatesTable(candidates, totalVotes) {
    if (!candidates || candidates.length === 0) {
        return '<p>No candidate data available</p>';
    }
    
    let tableHtml = `
        <h6>Candidates (${candidates.length} total)</h6>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Candidate</th>
                    <th>Party</th>
                    <th>Votes</th>
                    <th>Share</th>
                </tr>
            </thead>
            <tbody>`;
    
    // Show top 5 candidates
    const topCandidates = candidates.slice(0, 5);
    
    topCandidates.forEach((candidate, index) => {
        const isWinner = index === 0;
        const rowClass = isWinner ? 'table-success' : '';
        const badge = isWinner ? '<span class="badge bg-success ms-2">WINNER</span>' : '';
        
        tableHtml += `
            <tr class="${rowClass}">
                <td>${candidate.position || (index + 1)}</td>
                <td>${candidate.name}${badge}</td>
                <td><small>${candidate.party}</small></td>
                <td>${(candidate.votes || 0).toLocaleString()}</td>
                <td>
                    ${candidate.votes_percentage || 0}%
                    <div class="progress" style="height: 8px;">
                        <div class="progress-bar ${isWinner ? 'bg-success' : 'bg-secondary'}" 
                             style="width: ${candidate.votes_percentage || 0}%"></div>
                    </div>
                </td>
            </tr>`;
    });
    
    if (candidates.length > 5) {
        tableHtml += `
            <tr>
                <td colspan="5" class="text-center text-muted">
                    <small>... and ${candidates.length - 5} more candidates</small>
                </td>
            </tr>`;
    }
    
    tableHtml += `
            </tbody>
        </table>`;
    
    return tableHtml;
}

// Create results summary with visual indicators
function createResultsSummary(winner, runnerUp, marginPercent, yearData) {
    if (!winner) {
        return '<p>No results data available</p>';
    }
    
    const marginVotes = yearData.aggregate?.margin_votes || 0;
    const marginClass = marginPercent > 10 ? 'success' : marginPercent > 5 ? 'warning' : 'danger';
    
    return `
        <div class="results-summary">
            <h6>Election Summary</h6>
            
            <div class="alert alert-${marginClass} py-2">
                <strong>Victory Margin:</strong> ${marginVotes.toLocaleString()} votes (${marginPercent}%)
            </div>
            
            <div class="winner-info mb-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>Winner:</strong><br>
                        ${winner.name}<br>
                        <small class="text-muted">${winner.party}</small>
                    </div>
                    <div class="text-end">
                        <h4 class="mb-0 text-success">${winner.votes_percentage}%</h4>
                        <small>${winner.votes.toLocaleString()} votes</small>
                    </div>
                </div>
            </div>
            
            ${runnerUp ? `
            <div class="runner-up-info">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>Runner-up:</strong><br>
                        ${runnerUp.name}<br>
                        <small class="text-muted">${runnerUp.party}</small>
                    </div>
                    <div class="text-end">
                        <h5 class="mb-0">${runnerUp.votes_percentage}%</h5>
                        <small>${runnerUp.votes.toLocaleString()} votes</small>
                    </div>
                </div>
            </div>
            ` : ''}
            
            <hr>
            
            <div class="row text-center">
                <div class="col-6">
                    <small class="text-muted">Contestants</small><br>
                    <strong>${yearData.total_contestants || 0}</strong>
                </div>
                <div class="col-6">
                    <small class="text-muted">NOTA</small><br>
                    <strong>${yearData.nota_votes || 'N/A'}</strong>
                </div>
            </div>
        </div>
    `;
}

// Display MP Election Data (winners report format)
function displayElectionMPData(data) {
    const container = document.getElementById('dataTable');
    container.innerHTML = '';
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'election-mp-wrapper';
    
    // Check if it's the report format
    if (data.report_metadata && data.full_loksabha_winners_details) {
        displayMPReport(wrapper, data);
    } else if (data.results) {
        // If it has results structure like MLA, use similar display
        displayElectionMLAData(data);
        return;
    } else {
        wrapper.innerHTML = '<div class="alert alert-warning">Unknown MP election data format</div>';
    }
    
    container.appendChild(wrapper);
}

// Display MP winners report
function displayMPReport(wrapper, data) {
    // Add report header
    const header = document.createElement('div');
    header.className = 'alert alert-info mb-4';
    header.innerHTML = `
        <h4>${data.report_metadata.title || 'Lok Sabha Winners Report'}</h4>
        <div class="row mt-2">
            <div class="col-md-3">
                <strong>Total Winners:</strong> ${data.summary_and_highlights?.total_winners || 0}
            </div>
            <div class="col-md-3">
                <strong>With Criminal Cases:</strong> ${data.summary_and_highlights?.winners_with_criminal_cases || 0}
                <span class="text-danger ms-2">
                    (${Math.round((data.summary_and_highlights?.winners_with_criminal_cases / data.summary_and_highlights?.total_winners) * 100)}%)
                </span>
            </div>
            <div class="col-md-3">
                <strong>Crorepatis:</strong> ${data.summary_and_highlights?.crorepati_winners || 0}
                <span class="text-success ms-2">
                    (${Math.round((data.summary_and_highlights?.crorepati_winners / data.summary_and_highlights?.total_winners) * 100)}%)
                </span>
            </div>
            <div class="col-md-3">
                <strong>Parties:</strong> ${data.summary_and_highlights?.parties_represented || 0}
            </div>
        </div>
    `;
    wrapper.appendChild(header);
    
    // Create filters
    const filters = document.createElement('div');
    filters.className = 'row mb-3';
    filters.innerHTML = `
        <div class="col-md-3">
            <input type="text" class="form-control" id="mpSearchFilter" placeholder="Search constituency or candidate...">
        </div>
        <div class="col-md-2">
            <select class="form-select" id="mpPartyFilter">
                <option value="">All Parties</option>
            </select>
        </div>
        <div class="col-md-2">
            <select class="form-select" id="mpCriminalFilter">
                <option value="">All Candidates</option>
                <option value="clean">Clean (No Cases)</option>
                <option value="criminal">With Criminal Cases</option>
            </select>
        </div>
        <div class="col-md-2">
            <select class="form-select" id="mpWealthFilter">
                <option value="">All Wealth</option>
                <option value="crorepati">Crorepati (1Cr+)</option>
                <option value="multi">Multi-Crorepati (10Cr+)</option>
            </select>
        </div>
        <div class="col-md-3">
            <button class="btn btn-primary" onclick="filterMPData()">Apply Filters</button>
            <button class="btn btn-secondary ms-2" onclick="resetMPFilters()">Reset</button>
        </div>
    `;
    wrapper.appendChild(filters);
    
    // Create data table container
    const tableContainer = document.createElement('div');
    tableContainer.id = 'mpDataTable';
    tableContainer.className = 'table-responsive';
    
    // Populate party filter
    const parties = [...new Set(data.full_loksabha_winners_details.map(w => w.party))].sort();
    
    // Create the MP winners table
    createMPWinnersTable(tableContainer, data.full_loksabha_winners_details);
    
    wrapper.appendChild(tableContainer);
    
    // Add party options to filter after page loads
    setTimeout(() => {
        const partyFilter = document.getElementById('mpPartyFilter');
        if (partyFilter) {
            parties.forEach(party => {
                const option = document.createElement('option');
                option.value = party;
                option.textContent = party;
                partyFilter.appendChild(option);
            });
        }
    }, 100);
}

// Create MP winners table
function createMPWinnersTable(container, winners) {
    let tableHtml = `
        <table class="table table-sm table-hover" id="mpWinnersTable">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Constituency</th>
                    <th>Candidate</th>
                    <th>Party</th>
                    <th>Education</th>
                    <th>Assets</th>
                    <th>Liabilities</th>
                    <th>Criminal Cases</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;
    
    winners.forEach((winner, index) => {
        const assets = winner.total_assets_rs || 0;
        const liabilities = winner.liabilities_rs || 0;
        const netWorth = assets - liabilities;
        const cases = winner.total_no_of_cases || 0;
        
        // Color coding
        const casesClass = cases > 0 ? 'text-danger' : 'text-success';
        const wealthClass = assets > 100000000 ? 'text-primary fw-bold' : assets > 10000000 ? 'text-info' : '';
        
        tableHtml += `
            <tr data-party="${winner.party}" 
                data-cases="${cases}" 
                data-assets="${assets}"
                data-constituency="${winner.constituency}"
                data-candidate="${winner.candidate_name}">
                <td>${index + 1}</td>
                <td>${winner.constituency}</td>
                <td>${winner.candidate_name}</td>
                <td><small>${winner.party}</small></td>
                <td><small>${winner.education}</small></td>
                <td class="${wealthClass}">₹${formatCurrency(assets)}</td>
                <td>₹${formatCurrency(liabilities)}</td>
                <td class="${casesClass}">${cases}</td>
                <td>
                    ${winner.candidate_url ? 
                        `<a href="${winner.candidate_url}" target="_blank" class="btn btn-sm btn-outline-primary">Details</a>` 
                        : '-'}
                </td>
            </tr>`;
    });
    
    tableHtml += `
            </tbody>
        </table>`;
    
    container.innerHTML = tableHtml;
}

// Format currency for display
function formatCurrency(amount) {
    if (amount >= 10000000) {
        return (amount / 10000000).toFixed(2) + ' Cr';
    } else if (amount >= 100000) {
        return (amount / 100000).toFixed(2) + ' L';
    } else {
        return amount.toLocaleString();
    }
}

// Filter MP data
function filterMPData() {
    const searchTerm = document.getElementById('mpSearchFilter').value.toLowerCase();
    const partyFilter = document.getElementById('mpPartyFilter').value;
    const criminalFilter = document.getElementById('mpCriminalFilter').value;
    const wealthFilter = document.getElementById('mpWealthFilter').value;
    
    const rows = document.querySelectorAll('#mpWinnersTable tbody tr');
    
    rows.forEach(row => {
        let show = true;
        
        // Search filter
        if (searchTerm) {
            const constituency = row.dataset.constituency.toLowerCase();
            const candidate = row.dataset.candidate.toLowerCase();
            if (!constituency.includes(searchTerm) && !candidate.includes(searchTerm)) {
                show = false;
            }
        }
        
        // Party filter
        if (partyFilter && row.dataset.party !== partyFilter) {
            show = false;
        }
        
        // Criminal cases filter
        const cases = parseInt(row.dataset.cases);
        if (criminalFilter === 'clean' && cases > 0) {
            show = false;
        } else if (criminalFilter === 'criminal' && cases === 0) {
            show = false;
        }
        
        // Wealth filter
        const assets = parseInt(row.dataset.assets);
        if (wealthFilter === 'crorepati' && assets < 10000000) {
            show = false;
        } else if (wealthFilter === 'multi' && assets < 100000000) {
            show = false;
        }
        
        row.style.display = show ? '' : 'none';
    });
}

// Reset MP filters
function resetMPFilters() {
    document.getElementById('mpSearchFilter').value = '';
    document.getElementById('mpPartyFilter').value = '';
    document.getElementById('mpCriminalFilter').value = '';
    document.getElementById('mpWealthFilter').value = '';
    
    const rows = document.querySelectorAll('#mpWinnersTable tbody tr');
    rows.forEach(row => {
        row.style.display = '';
    });
}

// Main function to display election data
function displayElectionDataUnified(data, dataType) {
    if (dataType === 'election-mla') {
        displayElectionMLAData(data);
    } else if (dataType === 'election-mp') {
        displayElectionMPData(data);
    } else {
        // Fallback to table display
        const container = document.getElementById('dataTable');
        container.innerHTML = '<div class="alert alert-warning">Unknown election data type</div>';
    }
}

// Export functions if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        displayElectionDataUnified,
        displayElectionMLAData,
        displayElectionMPData
    };
}