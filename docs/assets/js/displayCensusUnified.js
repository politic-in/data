// Simplified census data display function for UNIFIED FORMAT ONLY
// This handles the standardized census format (like Andhra Pradesh structure)

function displayCensusDataUnified(data) {
    const container = document.getElementById('dataTable');
    container.innerHTML = '';
    
    // Create wrapper with Bootstrap grid
    const wrapper = document.createElement('div');
    wrapper.className = 'census-tables-wrapper';
    
    const grid = document.createElement('div');
    grid.className = 'row g-3';
    
    // 1. Population Overview
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
    
    // 2. Urban/Rural Distribution
    if (data.urban || data.rural) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        let tableHtml = `
            <div class="card">
                <div class="card-header bg-success text-white">
                    <h6 class="mb-0">Urban/Rural Distribution</h6>
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
        
        if (data.urban) {
            tableHtml += `
                <tr>
                    <td>Urban</td>
                    <td class="text-end">${(data.urban.population || 0).toLocaleString()}</td>
                    <td class="text-end">${data.urban.percentage_population || 0}%</td>
                    <td class="text-end">${data.urban.sex_ratio || 0}</td>
                </tr>`;
        }
        
        if (data.rural) {
            tableHtml += `
                <tr>
                    <td>Rural</td>
                    <td class="text-end">${(data.rural.population || 0).toLocaleString()}</td>
                    <td class="text-end">${data.rural.percentage_population || 0}%</td>
                    <td class="text-end">${data.rural.sex_ratio || 0}</td>
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
    
    // 3. Literacy Rates
    if (data.literacy || data.urban?.literacy_rate_percentage || data.rural?.literacy_rate_percentage) {
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
        
        // Overall literacy
        if (data.literacy) {
            tableHtml += `
                <tr>
                    <td><strong>Overall</strong></td>
                    <td class="text-end"><strong>${data.literacy.rate_percentage || 0}%</strong></td>
                    <td class="text-end">${data.literacy.male_literacy_rate || 0}%</td>
                    <td class="text-end">${data.literacy.female_literacy_rate || 0}%</td>
                </tr>`;
        }
        
        // Urban literacy
        if (data.urban?.literacy_rate_percentage) {
            tableHtml += `
                <tr>
                    <td>Urban</td>
                    <td class="text-end">${data.urban.literacy_rate_percentage || 0}%</td>
                    <td class="text-end">${data.urban.literacy_rate_male || 0}%</td>
                    <td class="text-end">${data.urban.literacy_rate_female || 0}%</td>
                </tr>`;
        }
        
        // Rural literacy
        if (data.rural?.literacy_rate_percentage) {
            tableHtml += `
                <tr>
                    <td>Rural</td>
                    <td class="text-end">${data.rural.literacy_rate_percentage || 0}%</td>
                    <td class="text-end">${data.rural.literacy_rate_male || 0}%</td>
                    <td class="text-end">${data.rural.literacy_rate_female || 0}%</td>
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
    
    // 4. Religion Distribution
    if (data.religion) {
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
        
        // Sort religions by population for better display
        const religions = Object.entries(data.religion)
            .sort((a, b) => (b[1].population || 0) - (a[1].population || 0));
        
        religions.forEach(([religion, religionData]) => {
            if (religionData && religionData.population > 0) {
                tableHtml += `
                    <tr>
                        <td>${religion}</td>
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
    
    // 5. Child Population (0-6 years)
    if (data.child_population) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        
        // Build child population details including urban/rural if available
        let childTableContent = `
            <tr><th>Total Children</th><td class="text-end">${(data.child_population.total || 0).toLocaleString()}</td></tr>
            <tr><th>Male</th><td class="text-end">${(data.child_population.male || 0).toLocaleString()}</td></tr>
            <tr><th>Female</th><td class="text-end">${(data.child_population.female || 0).toLocaleString()}</td></tr>
            <tr><th>Sex Ratio</th><td class="text-end">${data.child_population.sex_ratio || 0}</td></tr>
            <tr><th>% of Population</th><td class="text-end">${data.child_population.percentage_of_total_population || 0}%</td></tr>`;
        
        // Add urban child population if available
        if (data.urban?.child_population_total) {
            childTableContent += `
                <tr><th class="ps-3">Urban Children</th><td class="text-end">${(data.urban.child_population_total || 0).toLocaleString()}</td></tr>`;
        }
        
        // Add rural child population if available
        if (data.rural?.child_population_total) {
            childTableContent += `
                <tr><th class="ps-3">Rural Children</th><td class="text-end">${(data.rural.child_population_total || 0).toLocaleString()}</td></tr>`;
        }
        
        col.innerHTML = `
            <div class="card">
                <div class="card-header bg-secondary text-white">
                    <h6 class="mb-0">Child Population (0-6 years)</h6>
                </div>
                <div class="card-body">
                    <table class="table table-sm">
                        ${childTableContent}
                    </table>
                </div>
            </div>
        `;
        grid.appendChild(col);
    }
    
    // 6. Scheduled Caste & Tribe
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
            const sc_percentage = data.scheduled_caste.percentage || 
                                 data.scheduled_caste.percentage_of_total_population || 0;
            tableHtml += `
                <tr>
                    <td>Scheduled Caste</td>
                    <td class="text-end">${(data.scheduled_caste.total || 0).toLocaleString()}</td>
                    <td class="text-end">${sc_percentage}%</td>
                </tr>`;
        }
        
        if (data.scheduled_tribe) {
            const st_percentage = data.scheduled_tribe.percentage || 
                                 data.scheduled_tribe.percentage_of_total_population || 0;
            tableHtml += `
                <tr>
                    <td>Scheduled Tribe</td>
                    <td class="text-end">${(data.scheduled_tribe.total || 0).toLocaleString()}</td>
                    <td class="text-end">${st_percentage}%</td>
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
    
    // 7. Working Population (if available)
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
    
    // 8. Additional Statistics (if we have space)
    if (data.district || data.state || data.source_census2011) {
        const col = document.createElement('div');
        col.className = 'col-md-6';
        let infoContent = '<table class="table table-sm">';
        
        if (data.district) {
            infoContent += `<tr><th>District</th><td>${data.district}</td></tr>`;
        }
        if (data.state) {
            infoContent += `<tr><th>State</th><td>${data.state}</td></tr>`;
        }
        if (data.source_census2011) {
            const sourceUrl = data.source_census2011;
            const displayUrl = sourceUrl.length > 50 ? '...source link' : 'View Source';
            infoContent += `<tr><th>Source</th><td><a href="${sourceUrl}" target="_blank" rel="noopener">${displayUrl}</a></td></tr>`;
        }
        
        infoContent += '</table>';
        
        col.innerHTML = `
            <div class="card">
                <div class="card-header bg-light">
                    <h6 class="mb-0">Census Information</h6>
                </div>
                <div class="card-body">
                    ${infoContent}
                </div>
            </div>
        `;
        grid.appendChild(col);
    }
    
    wrapper.appendChild(grid);
    container.appendChild(wrapper);
}

// Export the function if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = displayCensusDataUnified;
}