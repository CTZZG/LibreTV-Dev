// --- 全局变量 ---
let selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '["heimuer"]');
let customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');

let currentEpisodeIndex = 0;
let currentEpisodes = [];
let currentVideoTitle = '';
let episodesReversed = false;

// --- 豆瓣推荐配置和状态 ---
const DOUBAN_CATEGORIES = {
    '热门': '%E7%83%AD%E9%97%A8',
    '国产剧': '%E5%9B%BD%E4%BA%A7%E5%89%A7',
    '美剧': '%E7%BE%8E%E5%89%A7',
    '英剧': '%E8%8B%B1%E5%89%A7',
    '日本动画': '%E6%97%A5%E6%9C%AC%E5%8A%A8%E7%94%BB',
    '纪录片': '%E7%BA%AA%E5%BD%95%E7%89%87',
    '综艺': '%E7%BB%BC%E8%89%BA'
};
const DOUBAN_PAGE_LIMIT = 30; // 每页加载数量
const DOUBAN_PROXY = "https://api.allorigins.win/raw?url="; // 解决跨域问题
let currentDoubanTag = '%E5%9B%BD%E4%BA%A7%E5%89%A7'; // 默认显示国产剧
let doubanPageStarts = {}; // 存储每个标签的下一页起始位置
Object.values(DOUBAN_CATEGORIES).forEach(tag => { doubanPageStarts[tag] = 0; });


// --- 页面初始化 ---
document.addEventListener('DOMContentLoaded', function() {
    initAPICheckboxes();
    renderCustomAPIsList();
    updateSelectedApiCount();
    renderSearchHistory();
    initDoubanTags(); // 初始化豆瓣标签按钮
    setupEventListeners();

    // 设置默认值（首次加载）
    if (!localStorage.getItem('hasInitializedDefaults')) {
        selectedAPIs = ["heimuer"];
        localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
        localStorage.setItem('yellowFilterEnabled', 'true');
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');
        localStorage.setItem('hasInitializedDefaults', 'true');
        initAPICheckboxes();
        updateSelectedApiCount();
    }

    // 初始化开关状态
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.checked = localStorage.getItem('yellowFilterEnabled') === 'true';
    }
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false';
    }

    setTimeout(checkAdultAPIsSelected, 100);

    // 加载默认豆瓣分类
    fetchDoubanTV(currentDoubanTag, 0);
    updateActiveTagButton(currentDoubanTag);

    checkPasswordProtection();
});

// --- API 选择和管理函数 ---

function initAPICheckboxes() {
    const container = document.getElementById('apiCheckboxes');
    if (!container) return;
    container.innerHTML = ''; // Clear previous checkboxes

    // Group for Normal APIs
    const normalTitle = document.createElement('div');
    normalTitle.className = 'api-group-title text-xs font-semibold text-gray-400 mb-1';
    normalTitle.textContent = '普通资源';
    container.appendChild(normalTitle);

    Object.keys(API_SITES).forEach(apiKey => {
        const api = API_SITES[apiKey];
        if (api.adult) return; // Skip adult APIs for now

        const isChecked = selectedAPIs.includes(apiKey);
        const div = document.createElement('div');
        div.className = 'flex items-center';
        div.innerHTML = `
            <input type="checkbox" id="api_${apiKey}"
                   class="form-checkbox h-3 w-3 text-blue-500 bg-[#2d2d2d] border-[#444] rounded focus:ring-blue-500 focus:ring-opacity-50 focus:ring-offset-0 focus:ring-offset-transparent"
                   ${isChecked ? 'checked' : ''}
                   data-api="${apiKey}">
            <label for="api_${apiKey}" class="ml-1.5 text-xs text-gray-300 truncate cursor-pointer select-none">${api.name}</label>
        `;
        const input = div.querySelector('input');
        input.addEventListener('change', () => {
            updateSelectedAPIs();
            checkAdultAPIsSelected();
        });
        container.appendChild(div);
    });

    // Group for Adult APIs (only if not hidden)
    if (typeof HIDE_BUILTIN_ADULT_APIS === 'undefined' || !HIDE_BUILTIN_ADULT_APIS) {
        const adultApisExist = Object.values(API_SITES).some(api => api.adult);
        if (adultApisExist) {
            const adultTitle = document.createElement('div');
            adultTitle.className = 'api-group-title adult text-xs font-semibold text-pink-400 mb-1 mt-2 flex items-center';
            adultTitle.innerHTML = `黄色资源采集站 <span class="adult-warning ml-1 text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </span>`;
            container.appendChild(adultTitle);

            Object.keys(API_SITES).forEach(apiKey => {
                const api = API_SITES[apiKey];
                if (!api.adult) return; // Only adult APIs here

                const isChecked = selectedAPIs.includes(apiKey);
                const div = document.createElement('div');
                div.className = 'flex items-center';
                div.innerHTML = `
                    <input type="checkbox" id="api_${apiKey}"
                           class="form-checkbox h-3 w-3 text-pink-500 bg-[#2d2d2d] border-[#444] rounded focus:ring-pink-500 focus:ring-opacity-50 focus:ring-offset-0 focus:ring-offset-transparent api-adult"
                           ${isChecked ? 'checked' : ''}
                           data-api="${apiKey}">
                    <label for="api_${apiKey}" class="ml-1.5 text-xs text-pink-300 truncate cursor-pointer select-none">${api.name}</label>
                `;
                const input = div.querySelector('input');
                input.addEventListener('change', () => {
                    updateSelectedAPIs();
                    checkAdultAPIsSelected();
                });
                container.appendChild(div);
            });
        }
    }
    // Initial check after rendering
    checkAdultAPIsSelected();
}


function checkAdultAPIsSelected() {
    const adultBuiltinCheckboxes = document.querySelectorAll('#apiCheckboxes .api-adult:checked');
    const customApiCheckboxes = document.querySelectorAll('#customApisList .api-adult:checked');
    const hasAdultSelected = adultBuiltinCheckboxes.length > 0 || customApiCheckboxes.length > 0;

    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (!yellowFilterToggle) return; // Exit if toggle not found

    const yellowFilterContainer = yellowFilterToggle.closest('.filter-container'); // Use parent container class
    const filterDescription = yellowFilterContainer?.querySelector('p.filter-description');

    if (!yellowFilterContainer || !filterDescription) return; // Exit if elements not found

    if (hasAdultSelected) {
        yellowFilterToggle.checked = false;
        yellowFilterToggle.disabled = true;
        localStorage.setItem('yellowFilterEnabled', 'false');
        yellowFilterContainer.classList.add('filter-disabled');
        filterDescription.innerHTML = '<strong class="text-pink-400">选中黄色资源站时无法启用过滤</strong>';
    } else {
        yellowFilterToggle.disabled = false;
        yellowFilterContainer.classList.remove('filter-disabled');
        filterDescription.textContent = '过滤"伦理片"等黄色内容'; // Restore original text
        // Ensure toggle reflects stored value if re-enabled
        yellowFilterToggle.checked = localStorage.getItem('yellowFilterEnabled') === 'true';
    }
}


function renderCustomAPIsList() {
    const container = document.getElementById('customApisList');
    if (!container) return;

    if (customAPIs.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>';
        return;
    }

    container.innerHTML = ''; // Clear list
    customAPIs.forEach((api, index) => {
        const apiItem = document.createElement('div');
        apiItem.className = 'flex items-center justify-between p-1.5 mb-1 bg-[#2a2a2a] rounded hover:bg-[#333]'; // Slightly darker bg

        const textColorClass = api.isAdult ? 'text-pink-400' : 'text-gray-300';
        const adultTag = api.isAdult ? '<span class="text-[10px] font-semibold text-pink-400 mr-1">(18+)</span>' : '';

        apiItem.innerHTML = `
            <div class="flex items-center flex-1 min-w-0 mr-2">
                <input type="checkbox" id="custom_api_${index}"
                       class="form-checkbox h-3 w-3 text-blue-500 mr-1.5 ${api.isAdult ? 'api-adult' : ''} bg-[#2d2d2d] border-[#444] rounded focus:ring-blue-500 focus:ring-opacity-50 focus:ring-offset-0 focus:ring-offset-transparent"
                       ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''}
                       data-custom-index="${index}">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium ${textColorClass} truncate" title="${api.name}">
                        ${adultTag}${api.name}
                    </div>
                    <div class="text-[10px] text-gray-500 truncate" title="${api.url}">${api.url}</div>
                </div>
            </div>
            <div class="flex items-center flex-shrink-0">
                <button class="text-blue-400 hover:text-blue-300 text-xs px-1" onclick="editCustomApi(${index})" title="编辑">✎</button>
                <button class="text-red-500 hover:text-red-400 text-xs px-1" onclick="removeCustomApi(${index})" title="删除">✕</button>
            </div>
        `;
        const input = apiItem.querySelector('input');
        input.addEventListener('change', () => {
            updateSelectedAPIs();
            checkAdultAPIsSelected();
        });
        container.appendChild(apiItem);
    });
}

function editCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const api = customAPIs[index];
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const isAdultInput = document.getElementById('customApiIsAdult');
    const form = document.getElementById('addCustomApiForm');

    if (!nameInput || !urlInput || !isAdultInput || !form) return;

    nameInput.value = api.name;
    urlInput.value = api.url;
    isAdultInput.checked = api.isAdult || false;

    form.classList.remove('hidden');
    const buttonContainer = form.querySelector('div:last-child');
    if (buttonContainer) {
        buttonContainer.innerHTML = `
            <button type="button" onclick="updateCustomApi(${index})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">更新</button>
            <button type="button" onclick="cancelEditCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs ml-2">取消</button>
        `;
    }
}


function updateCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const isAdultInput = document.getElementById('customApiIsAdult');

    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const isAdult = isAdultInput ? isAdultInput.checked : false;

    if (!name || !url) { showToast('请输入API名称和链接', 'warning'); return; }
    if (!/^https?:\/\/.+/.test(url)) { showToast('API链接格式不正确', 'warning'); return; }
    if (url.endsWith('/')) { url = url.slice(0, -1); }

    customAPIs[index] = { name, url, isAdult };
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

    renderCustomAPIsList();
    checkAdultAPIsSelected();
    restoreAddCustomApiButtons(); // Restore buttons after update

    // Clear and hide form
    nameInput.value = '';
    urlInput.value = '';
    isAdultInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');

    showToast('已更新自定义API: ' + name, 'success');
}


function cancelEditCustomApi() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        document.getElementById('customApiName').value = '';
        document.getElementById('customApiUrl').value = '';
        const isAdultInput = document.getElementById('customApiIsAdult');
        if (isAdultInput) isAdultInput.checked = false;
        form.classList.add('hidden');
        restoreAddCustomApiButtons(); // Ensure add buttons are restored
    }
}


function restoreAddCustomApiButtons() {
    const form = document.getElementById('addCustomApiForm');
    if (!form) return;
    const buttonContainer = form.querySelector('div:last-child');
    if (buttonContainer) {
        buttonContainer.innerHTML = `
            <button type="button" onclick="addCustomApi()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">添加</button>
            <button type="button" onclick="cancelAddCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs ml-2">取消</button>
        `;
    }
}


function updateSelectedAPIs() {
    const builtInApiCheckboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"]:checked');
    const customApiCheckboxes = document.querySelectorAll('#customApisList input[type="checkbox"]:checked');

    const builtInApis = Array.from(builtInApiCheckboxes).map(input => input.dataset.api);
    const customApiIndices = Array.from(customApiCheckboxes).map(input => 'custom_' + input.dataset.customIndex);

    selectedAPIs = [...builtInApis, ...customApiIndices];
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
    updateSelectedApiCount();
}


function updateSelectedApiCount() {
    const countEl = document.getElementById('selectedApiCount');
    if (countEl) {
        countEl.textContent = selectedAPIs.length;
    }
}


function selectAllAPIs(selectAll = true, excludeAdult = false) {
    const builtInCheckboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"]');
    const customCheckboxes = document.querySelectorAll('#customApisList input[type="checkbox"]');

    builtInCheckboxes.forEach(checkbox => {
        const isAdult = API_SITES[checkbox.dataset.api]?.adult;
        if (excludeAdult && isAdult) {
            checkbox.checked = false;
        } else {
            checkbox.checked = selectAll;
        }
    });

    customCheckboxes.forEach(checkbox => {
         const index = parseInt(checkbox.dataset.customIndex);
         const isAdult = customAPIs[index]?.isAdult;
        if (excludeAdult && isAdult) {
            checkbox.checked = false;
        } else {
            checkbox.checked = selectAll;
        }
    });

    updateSelectedAPIs();
    checkAdultAPIsSelected(); // Update filter status after selection change
}


function showAddCustomApiForm() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
        restoreAddCustomApiButtons(); // Ensure correct buttons are shown
    }
}


function cancelAddCustomApi() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.add('hidden');
        document.getElementById('customApiName').value = '';
        document.getElementById('customApiUrl').value = '';
        const isAdultInput = document.getElementById('customApiIsAdult');
        if (isAdultInput) isAdultInput.checked = false;
        restoreAddCustomApiButtons(); // Restore buttons on cancel
    }
}


function addCustomApi() {
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const isAdultInput = document.getElementById('customApiIsAdult');

    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const isAdult = isAdultInput ? isAdultInput.checked : false;

    if (!name || !url) { showToast('请输入API名称和链接', 'warning'); return; }
    if (!/^https?:\/\/.+/.test(url)) { showToast('API链接格式不正确', 'warning'); return; }
    if (url.endsWith('/')) { url = url.slice(0, -1); }

    // Check for duplicates (optional but good practice)
    const exists = customAPIs.some(api => api.url === url || api.name === name);
    if (exists) {
        showToast('已存在相同名称或链接的自定义API', 'warning');
        return;
    }

    customAPIs.push({ name, url, isAdult });
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

    // Select the newly added API by default
    const newApiIndex = customAPIs.length - 1;
    selectedAPIs.push('custom_' + newApiIndex);
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    renderCustomAPIsList();
    updateSelectedApiCount();
    checkAdultAPIsSelected();

    // Clear and hide form
    nameInput.value = '';
    urlInput.value = '';
    isAdultInput.checked = false;
    document.getElementById('addCustomApiForm').classList.add('hidden');
    restoreAddCustomApiButtons(); // Restore buttons

    showToast('已添加自定义API: ' + name, 'success');
}


function removeCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;

    const apiName = customAPIs[index].name;

    // Confirm before deleting
    if (!confirm(`确定要删除自定义API "${apiName}" 吗？`)) {
        return;
    }

    customAPIs.splice(index, 1);
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

    // Remove from selected APIs and update indices
    const customApiIdToRemove = 'custom_' + index;
    const newSelectedAPIs = [];
    selectedAPIs.forEach(id => {
        if (id === customApiIdToRemove) return; // Skip the removed one
        if (id.startsWith('custom_')) {
            const currentIndex = parseInt(id.replace('custom_', ''));
            if (currentIndex > index) {
                newSelectedAPIs.push('custom_' + (currentIndex - 1)); // Adjust index
            } else {
                newSelectedAPIs.push(id); // Keep index as is
            }
        } else {
            newSelectedAPIs.push(id); // Keep built-in APIs
        }
    });
    selectedAPIs = newSelectedAPIs;
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    renderCustomAPIsList();
    updateSelectedApiCount();
    checkAdultAPIsSelected();

    showToast('已移除自定义API: ' + apiName, 'info');
}

function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex);
    if (isNaN(index) || index < 0 || index >= customAPIs.length) {
        return null;
    }
    return customAPIs[index];
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                search();
            }
        });
    }

    document.addEventListener('click', function(e) {
        const settingsPanel = document.getElementById('settingsPanel');
        const historyPanel = document.getElementById('historyPanel');
        const settingsButton = document.querySelector('button[onclick="toggleSettings(event)"]');
        const historyButton = document.querySelector('button[onclick="toggleHistory(event)"]');

        // Close settings panel if click is outside
        if (settingsPanel && settingsButton && !settingsPanel.contains(e.target) && !settingsButton.contains(e.target) && settingsPanel.classList.contains('show')) {
            settingsPanel.classList.remove('show');
             settingsPanel.classList.add('translate-x-full'); // Use translate for consistency
        }
        // Close history panel if click is outside
        if (historyPanel && historyButton && !historyPanel.contains(e.target) && !historyButton.contains(e.target) && historyPanel.classList.contains('show')) {
             historyPanel.classList.remove('show');
             historyPanel.classList.add('-translate-x-full');
        }
    });

    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.addEventListener('change', function(e) {
            localStorage.setItem('yellowFilterEnabled', e.target.checked);
            // Re-filter results if they are currently displayed? (Optional)
            // if (!document.getElementById('resultsArea').classList.contains('hidden')) {
            //     search(); // This might be too disruptive, maybe just filter current results
            // }
        });
    }

    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.addEventListener('change', function(e) {
            localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, e.target.checked);
        });
    }
}

// --- Search and Results ---

function resetSearchArea() {
    const resultsDiv = document.getElementById('results');
    const searchInput = document.getElementById('searchInput');
    const searchArea = document.getElementById('searchArea');
    const resultsArea = document.getElementById('resultsArea');
    const doubanContainer = document.getElementById("douban-results");
    const doubanTagsContainer = document.getElementById("douban-tags-container");
    const footer = document.querySelector('.footer');

    if (resultsDiv) resultsDiv.innerHTML = '';
    if (searchInput) searchInput.value = '';
    if (searchArea) searchArea.classList.remove('mb-8');
    if (resultsArea) resultsArea.classList.add('hidden');

    // Restore Douban sections
    if (doubanContainer) doubanContainer.style.display = "grid";
    if (doubanTagsContainer) doubanTagsContainer.style.display = "flex";

    if (footer) { footer.style.position = ''; }
}

async function search() {
    // Password check
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }

    const query = document.getElementById('searchInput').value.trim();
    if (!query) { showToast('请输入搜索内容', 'info'); return; }
    if (selectedAPIs.length === 0) { showToast('请至少选择一个API源', 'warning'); return; }

    showLoading();

    // Hide Douban sections
    const doubanContainer = document.getElementById("douban-results");
    const doubanTagsContainer = document.getElementById("douban-tags-container");
    if (doubanContainer) doubanContainer.style.display = "none";
    if (doubanTagsContainer) doubanTagsContainer.style.display = "none";

    try {
        saveSearchHistory(query);

        let allResults = [];
        const searchPromises = selectedAPIs.map(async (apiId) => {
            try {
                let apiUrl, apiName, sourceUrl;
                if (apiId.startsWith('custom_')) {
                    const customIndex = apiId.replace('custom_', '');
                    const customApi = getCustomApiInfo(customIndex);
                    if (!customApi) return [];
                    sourceUrl = customApi.url;
                    apiName = customApi.name;
                } else {
                    if (!API_SITES[apiId]) return [];
                    sourceUrl = API_SITES[apiId].api;
                    apiName = API_SITES[apiId].name;
                }
                apiUrl = sourceUrl + API_CONFIG.search.path + encodeURIComponent(query);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

                const response = await fetch(PROXY_URL + encodeURIComponent(apiUrl), {
                    headers: API_CONFIG.search.headers,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.warn(`API ${apiName} (${apiId}) failed with status ${response.status}`);
                    return [];
                }

                const data = await response.json();
                if (!data || !data.list || !Array.isArray(data.list)) { // Allow empty list
                     if (data && data.code && ![0, 1, 200].includes(data.code)) { // Check for non-success codes
                         console.warn(`API ${apiName} (${apiId}) returned error code ${data.code}: ${data.msg}`);
                         return [];
                     }
                     if (!data || typeof data !== 'object' || (data.list && !Array.isArray(data.list))) {
                         console.warn(`API ${apiName} (${apiId}) returned invalid data format.`);
                         return [];
                     }
                 }

                return (data.list || []).map(item => ({
                    ...item,
                    source_name: apiName,
                    source_code: apiId, // Keep original ID (e.g., 'custom_0')
                    api_url: apiId.startsWith('custom_') ? sourceUrl : undefined // Store URL for custom APIs
                }));
            } catch (error) {
                if (error.name !== 'AbortError') { // Don't log AbortError as a failure
                    console.warn(`API ${apiId} search failed:`, error);
                } else {
                    console.warn(`API ${apiId} search timed out.`);
                }
                return [];
            }
        });

        const resultsArray = await Promise.all(searchPromises);
        allResults = resultsArray.flat(); // Flatten the array of arrays

        // Show results area
        document.getElementById('searchArea').classList.add('mb-8');
        document.getElementById('resultsArea').classList.remove('hidden');
        const resultsDiv = document.getElementById('results');

        if (allResults.length === 0) {
            resultsDiv.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3>
                    <p class="mt-1 text-sm text-gray-500">请尝试其他关键词或更换数据源</p>
                </div>`;
            hideLoading();
            return;
        }

        // Apply yellow content filter
        const yellowFilterEnabled = localStorage.getItem('yellowFilterEnabled') === 'true';
        if (yellowFilterEnabled) {
            const banned = ['伦理片','门事件','萝莉少女','制服诱惑','国产传媒','cosplay','黑丝诱惑','无码','日本无码','有码','日本有码','SWAG','网红主播', '色情片','同性片','福利视频','福利片'];
            allResults = allResults.filter(item => {
                const typeName = item.type_name || '';
                return !banned.some(keyword => typeName.includes(keyword));
            });
        }
         // Re-check if filtering removed all results
        if (allResults.length === 0) {
            resultsDiv.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-400">找到一些结果，但已被内容过滤器隐藏</h3>
                    <p class="mt-1 text-sm text-gray-500">您可以在设置中关闭黄色内容过滤</p>
                </div>`;
            hideLoading();
            return;
        }

        // Render result cards (Using object-cover as per your previous app.js)
        resultsDiv.innerHTML = allResults.map(item => {
            const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
            const safeName = (item.vod_name || '未知标题').toString().replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
            const sourceInfo = item.source_name ? `<span class="bg-[#2a2a2a] text-xs px-2 py-0.5 rounded-full shadow">${item.source_name}</span>` : '';
            const sourceCode = item.source_code || ''; // e.g., 'heimuer' or 'custom_0'
            const apiUrlAttr = item.api_url ? `data-api-url="${item.api_url.replace(/"/g, '"')}"` : '';
            const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

            return `
                <div class="card-hover bg-[#1a1a1a] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg h-full flex flex-col"
                     onclick="showDetails('${safeId}','${safeName}','${sourceCode}')" ${apiUrlAttr}>
                    <div class="flex-shrink-0 ${hasCover ? 'md:h-full md:w-auto' : ''}"> {/* Adjusted for vertical card layout */}
                        ${hasCover ? `
                        <div class="relative overflow-hidden aspect-[2/3] bg-black/20"> {/* Force aspect ratio */}
                             <img src="${proxyImage(item.vod_pic)}" alt="${safeName}"
                                  class="w-full h-full object-cover transition-transform group-hover:scale-105" /* Use object-cover */
                                  onerror="this.onerror=null; this.src='https://via.placeholder.com/200x300?text=No+Image'; this.classList.add('object-contain');"
                                  loading="lazy">
                             <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-80 pointer-events-none"></div>
                        </div>` :
                        `<div class="h-48 md:h-full flex items-center justify-center bg-[#2a2a2a] text-gray-500 aspect-[2/3]">无封面</div>`}
                    </div>
                    <div class="p-3 flex flex-col flex-grow justify-between">
                        <div>
                            <h3 class="text-sm md:text-base font-semibold mb-1.5 break-words leading-tight h-10 overflow-hidden" title="${safeName}">${safeName}</h3>
                            <div class="flex flex-wrap gap-1 mb-1.5">
                                ${(item.type_name || '').toString().replace(/</g, '<') ?
                                  `<span class="text-[10px] py-0.5 px-1.5 rounded bg-blue-500/20 text-blue-300">${(item.type_name || '').toString().replace(/</g, '<')}</span>` : ''}
                                ${(item.vod_year || '') ?
                                  `<span class="text-[10px] py-0.5 px-1.5 rounded bg-purple-500/20 text-purple-300">${item.vod_year}</span>` : ''}
                            </div>
                            <p class="text-gray-400 text-xs h-8 overflow-hidden leading-snug" title="${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '<')}">
                                ${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '<')}
                            </p>
                        </div>
                        <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-800/50">
                            ${sourceInfo ? `<div class="text-[10px] text-gray-400">${sourceInfo}</div>` : '<div></div>'}
                            <span class="text-xs text-cyan-400 flex items-center opacity-80 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                播放
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('搜索处理错误:', error);
        showToast('搜索过程中发生错误', 'error');
    } finally {
        hideLoading();
        // Ensure Douban remains hidden after search, even on error
        if (doubanContainer && doubanContainer.style.display !== "none") doubanContainer.style.display = "none";
        if (doubanTagsContainer && doubanTagsContainer.style.display !== "none") doubanTagsContainer.style.display = "none";
    }
}


// --- 详情和播放函数 ---
async function showDetails(id, vod_name, sourceCode) {
    // Password check
    if (window.isPasswordProtected && window.isPasswordVerified) { /* ... */ }
    if (!id) { showToast('视频ID无效', 'error'); return; }

    showLoading();
    try {
        let apiUrlForDetails;
        let detailParams = `id=${encodeURIComponent(id)}`;

        // Determine API URL for detail request
        if (sourceCode.startsWith('custom_')) {
            const customIndex = sourceCode.replace('custom_', '');
            const customApi = getCustomApiInfo(customIndex);
            if (!customApi) { throw new Error('无法找到自定义API配置'); }
            apiUrlForDetails = customApi.url + API_CONFIG.detail.path; // Assume standard path
            detailParams += `&customApi=${encodeURIComponent(customApi.url)}&source=custom`; // Pass params for potential backend use
        } else {
            if (!API_SITES[sourceCode]) { throw new Error('无效的内置API源'); }
            apiUrlForDetails = API_SITES[sourceCode].api + API_CONFIG.detail.path; // Assume standard path
            detailParams += `&source=${sourceCode}`;
        }

        // Construct the full API URL to be proxied
        const fullDetailApiUrl = apiUrlForDetails + id; // Path usually ends with ids=

        // Fetch details via proxy
        // ** IMPORTANT: Adapt this URL based on whether you use Frontend (Version 1) or Backend (Version 2) API handling **
        // This code assumes Version 1 (API logic in frontend, calling proxy directly)
        const fetchUrl = `${PROXY_URL}${encodeURIComponent(fullDetailApiUrl)}`;

        // If using Version 2 (API logic in backend functions):
        // const fetchUrl = `/api/detail?${detailParams}`; // Call your backend detail function

        const response = await fetch(fetchUrl); // Fetch via proxy or backend function

        if (!response.ok) {
            let errorMsg = `获取详情失败 (${response.status})`;
            try { const errData = await response.json(); errorMsg = errData.msg || errData.error || errorMsg; } catch(e) {}
            throw new Error(errorMsg);
        }

        const data = await response.json();
        // For Version 2, data might already be processed. Adapt if needed.
        // For Version 1, the proxy returns the raw API response, so we process here.

        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        if (!modal || !modalTitle || !modalContent) return;

        // Extract info (Handle cases where backend might pre-process)
        const videoInfo = data.videoInfo || (data.list && data.list[0]) || {}; // Adapt based on actual response structure
        const episodesRaw = data.episodes || videoInfo.vod_play_url || ''; // Get episodes from data or videoInfo

        const sourceName = videoInfo.source_name || (sourceCode.startsWith('custom_') ? getCustomApiInfo(sourceCode.replace('custom_', ''))?.name : API_SITES[sourceCode]?.name) || '未知来源';
        const displayTitle = vod_name || videoInfo.vod_name || '未知视频';

        modalTitle.innerHTML = `<span class="break-words">${displayTitle}</span><span class="text-sm font-normal text-gray-400 ml-2">(${sourceName})</span>`;
        currentVideoTitle = displayTitle;

        // Process episodes string (assuming standard $$$ and # separators if needed)
        let processedEpisodes = [];
        if (typeof episodesRaw === 'string' && episodesRaw.includes('$')) {
            const playSources = episodesRaw.split('$$$');
            if (playSources.length > 0) {
                const mainSource = playSources[0];
                processedEpisodes = mainSource.split('#').map(ep => {
                    const parts = ep.split('$');
                    return parts.length > 1 ? parts[1] : '';
                }).filter(url => url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith(PROXY_URL))); // Allow proxied URLs too
            }
        } else if (Array.isArray(episodesRaw)) {
             processedEpisodes = episodesRaw.filter(url => url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith(PROXY_URL)));
        }

        currentEpisodes = processedEpisodes; // Store the final list of episode URLs

        if (currentEpisodes.length > 0) {
            episodesReversed = false; // Reset order
            modalContent.innerHTML = `
                <div class="flex justify-end mb-3">
                    <button onclick="toggleEpisodeOrder()" class="px-3 py-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center space-x-1.5 text-xs">
                        <svg id="episodeOrderIcon" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd" /></svg>
                        <span id="episodeOrderText">倒序排列</span>
                    </button>
                </div>
                <div id="episodesGrid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">
                    ${renderEpisodes(displayTitle)}
                </div>`;
            // Initial state for order button icon
             document.getElementById('episodeOrderIcon').style.transform = '';
        } else {
            modalContent.innerHTML = '<p class="text-center text-gray-400 py-8">没有找到可播放的视频剧集</p>';
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex'); // Use flex for centering

    } catch (error) {
        console.error('获取详情错误:', error);
        showToast(`获取详情失败: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}


function playVideo(url, vod_name, episodeIndex = 0) {
    // Password check
    if (window.isPasswordProtected && window.isPasswordVerified) { /* ... */ }
    if (!url) { showToast('无效的视频链接', 'error'); return; }

    let sourceName = '';
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) {
        const sourceSpan = modalTitle.querySelector('span.text-gray-400');
        if (sourceSpan) {
            const match = sourceSpan.textContent.match(/\(([^)]+)\)/);
            if (match && match[1]) { sourceName = match[1].trim(); }
        }
    }

    // Save state to localStorage
    const videoTitle = vod_name || currentVideoTitle;
    localStorage.setItem('currentVideoTitle', videoTitle);
    localStorage.setItem('currentEpisodeIndex', episodeIndex);
    localStorage.setItem('currentEpisodes', JSON.stringify(currentEpisodes));
    localStorage.setItem('episodesReversed', episodesReversed);

    // Save to viewing history
    const videoInfo = {
        title: videoTitle,
        url: url, // Save the URL being played
        episodeIndex: episodeIndex,
        sourceName: sourceName,
        timestamp: Date.now(),
        episodes: currentEpisodes && currentEpisodes.length > 0 ? [...currentEpisodes] : []
    };
    if (typeof addToViewingHistory === 'function') {
        addToViewingHistory(videoInfo);
    }

    // Open player page
    const playerUrl = `player.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(videoTitle)}&index=${episodeIndex}&source=${encodeURIComponent(sourceName)}`;
    window.open(playerUrl, '_blank');
}


function playPreviousEpisode() {
    // ... (逻辑不变, 保持原有格式)
     if (currentEpisodeIndex > 0) {
        const prevIndex = currentEpisodeIndex - 1;
        const prevUrl = currentEpisodes[prevIndex];
        playVideo(prevUrl, currentVideoTitle, prevIndex);
    }
}


function playNextEpisode() {
    // ... (逻辑不变, 保持原有格式)
     if (currentEpisodeIndex < currentEpisodes.length - 1) {
        const nextIndex = currentEpisodeIndex + 1;
        const nextUrl = currentEpisodes[nextIndex];
        playVideo(nextUrl, currentVideoTitle, nextIndex);
    }
}


function handlePlayerError() {
    // ... (逻辑不变, 保持原有格式)
    hideLoading();
    showToast('视频播放加载失败，请尝试其他视频源', 'error');
}


function renderEpisodes(vodName) {
    // Ensure vodName is a string for replace function
    const safeVodName = String(vodName || '');
    const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    if (episodes.length === 0) return '<p class="col-span-full text-center text-gray-500 text-sm">无剧集信息</p>'; // Handle empty episodes

    return episodes.map((episode, index) => {
        const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index;
        // Ensure episode URL is valid before creating button
        if (!episode || typeof episode !== 'string') return '';

        // Escape single quotes in vodName for the onclick attribute
        const escapedVodName = safeVodName.replace(/'/g, "\\'");

        return `
            <button id="episode-${realIndex}"
                    onclick="playVideo('${episode}', '${escapedVodName}', ${realIndex})"
                    class="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#383838] border border-[#444] rounded-md transition-colors text-center text-xs text-gray-300 truncate episode-btn focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50"
                    title="播放 第${realIndex + 1}集">
                第 ${realIndex + 1} 集
            </button>
        `;
    }).join('');
}


function toggleEpisodeOrder() {
    episodesReversed = !episodesReversed;
    const episodesGrid = document.getElementById('episodesGrid');
    if (episodesGrid) {
        episodesGrid.innerHTML = renderEpisodes(currentVideoTitle); // Re-render with new order
    }

    // Update button text and icon
    const toggleBtn = document.querySelector('button[onclick="toggleEpisodeOrder()"]');
    if (toggleBtn) {
        const textSpan = toggleBtn.querySelector('span');
        const icon = toggleBtn.querySelector('svg');
        if (textSpan) textSpan.textContent = episodesReversed ? '正序排列' : '倒序排列';
        if (icon) icon.style.transform = episodesReversed ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}


// --- 密码保护 (保持不变) ---
function checkPasswordProtection() {
    // ... (逻辑不变, 保持原有格式)
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
             showPasswordModal && showPasswordModal();
        }
     }
}
