// --- 全局变量 ---
let selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '["heimuer"]');
let customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]');

let currentEpisodeIndex = 0;
let currentEpisodes = [];
let currentVideoTitle = '';
let episodesReversed = false;

// --- 豆瓣推荐相关变量 (使用工作示例中的变量名和逻辑) ---
let doubanPageStart = 0; // 当前分类的起始页码
const doubanPageSize = 12; // 每页显示数量 (调整为你想要的数量)
const doubanTags = ['热门', '美剧', '英剧', '国产剧', '日本动画', '纪录片', '综艺']; // 标签顺序
let doubanCurrentTag = localStorage.getItem('doubanCurrentTag') || '热门'; // 默认加载热门，并从 localStorage 读取
const DOUBAN_PROXY = "https://api.allorigins.win/raw?url="; // 豆瓣 API 代理

// --- 页面初始化 ---
document.addEventListener('DOMContentLoaded', function() {
    initAPICheckboxes();
    renderCustomAPIsList();
    updateSelectedApiCount();
    renderSearchHistory();
    setupEventListeners();

    // --- 初始化豆瓣推荐 ---
    renderDoubanTags(); // 渲染标签按钮
    setupDoubanRefreshBtn(); // 设置“换一批”按钮监听
    renderRecommend(doubanCurrentTag, doubanPageSize, 0); // 加载默认分类第一页

    // --- 设置默认值 (首次加载) ---
    if (!localStorage.getItem('hasInitializedDefaults')) {
        selectedAPIs = ["heimuer"]; // 默认仅选中一个源
        localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
        localStorage.setItem('yellowFilterEnabled', 'true');
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');
        localStorage.setItem('hasInitializedDefaults', 'true');
        // 重新应用默认选择到 UI
        initAPICheckboxes();
        updateSelectedApiCount();
    }

    // --- 初始化开关状态 ---
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.checked = localStorage.getItem('yellowFilterEnabled') === 'true';
    }
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false';
    }

    setTimeout(checkAdultAPIsSelected, 100); // 检查成人 API 状态
    checkPasswordProtection(); // 检查密码保护
});


// --- API 选择和管理函数 ---
function initAPICheckboxes() {
    const container = document.getElementById('apiCheckboxes');
    if (!container) return;
    container.innerHTML = '';

    const normalTitle = document.createElement('div');
    normalTitle.className = 'api-group-title text-xs font-semibold text-gray-400 mb-1';
    normalTitle.textContent = '普通资源';
    container.appendChild(normalTitle);

    Object.keys(API_SITES).forEach(apiKey => {
        const api = API_SITES[apiKey];
        if (api.adult) return;

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
                if (!api.adult) return;

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
    checkAdultAPIsSelected();
}

function checkAdultAPIsSelected() {
    const adultBuiltinCheckboxes = document.querySelectorAll('#apiCheckboxes .api-adult:checked');
    const customApiCheckboxes = document.querySelectorAll('#customApisList .api-adult:checked');
    const hasAdultSelected = adultBuiltinCheckboxes.length > 0 || customApiCheckboxes.length > 0;
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (!yellowFilterToggle) return;
    const yellowFilterContainer = yellowFilterToggle.closest('.filter-container');
    const filterDescription = yellowFilterContainer?.querySelector('p.filter-description');
    if (!yellowFilterContainer || !filterDescription) return;

    if (hasAdultSelected) {
        yellowFilterToggle.checked = false;
        yellowFilterToggle.disabled = true;
        localStorage.setItem('yellowFilterEnabled', 'false');
        yellowFilterContainer.classList.add('filter-disabled');
        filterDescription.innerHTML = '<strong class="text-pink-400">选中黄色资源站时无法启用过滤</strong>';
    } else {
        yellowFilterToggle.disabled = false;
        yellowFilterContainer.classList.remove('filter-disabled');
        filterDescription.textContent = '过滤"伦理片"等黄色内容';
        yellowFilterToggle.checked = localStorage.getItem('yellowFilterEnabled') === 'true';
    }
}

function renderCustomAPIsList() {
    const container = document.getElementById('customApisList');
    if (!container) return;
    if (customAPIs.length === 0) { container.innerHTML = '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>'; return; }
    container.innerHTML = '';
    customAPIs.forEach((api, index) => {
        const apiItem = document.createElement('div');
        apiItem.className = 'flex items-center justify-between p-1.5 mb-1 bg-[#2a2a2a] rounded hover:bg-[#333]';
        const textColorClass = api.isAdult ? 'text-pink-400' : 'text-gray-300';
        const adultTag = api.isAdult ? '<span class="text-[10px] font-semibold text-pink-400 mr-1">(18+)</span>' : '';
        apiItem.innerHTML = `
            <div class="flex items-center flex-1 min-w-0 mr-2">
                <input type="checkbox" id="custom_api_${index}" class="form-checkbox h-3 w-3 text-blue-500 mr-1.5 ${api.isAdult ? 'api-adult' : ''} bg-[#2d2d2d] border-[#444] rounded focus:ring-blue-500 focus:ring-opacity-50 focus:ring-offset-0 focus:ring-offset-transparent" ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''} data-custom-index="${index}">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium ${textColorClass} truncate" title="${api.name}">${adultTag}${api.name}</div>
                    <div class="text-[10px] text-gray-500 truncate" title="${api.url}">${api.url}</div>
                </div>
            </div>
            <div class="flex items-center flex-shrink-0">
                <button class="text-blue-400 hover:text-blue-300 text-xs px-1" onclick="editCustomApi(${index})" title="编辑">✎</button>
                <button class="text-red-500 hover:text-red-400 text-xs px-1" onclick="removeCustomApi(${index})" title="删除">✕</button>
            </div>`;
        const input = apiItem.querySelector('input');
        input.addEventListener('change', () => { updateSelectedAPIs(); checkAdultAPIsSelected(); });
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
    nameInput.value = api.name; urlInput.value = api.url; isAdultInput.checked = api.isAdult || false;
    form.classList.remove('hidden');
    const buttonContainer = form.querySelector('div:last-child');
    if (buttonContainer) {
        buttonContainer.innerHTML = `
            <button type="button" onclick="updateCustomApi(${index})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">更新</button>
            <button type="button" onclick="cancelEditCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs ml-2">取消</button>`;
    }
}

function updateCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const nameInput = document.getElementById('customApiName'); const urlInput = document.getElementById('customApiUrl'); const isAdultInput = document.getElementById('customApiIsAdult');
    const name = nameInput.value.trim(); let url = urlInput.value.trim(); const isAdult = isAdultInput ? isAdultInput.checked : false;
    if (!name || !url) { showToast('请输入API名称和链接', 'warning'); return; }
    if (!/^https?:\/\/.+/.test(url)) { showToast('API链接格式不正确', 'warning'); return; }
    if (url.endsWith('/')) { url = url.slice(0, -1); }
    customAPIs[index] = { name, url, isAdult }; localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    renderCustomAPIsList(); checkAdultAPIsSelected(); restoreAddCustomApiButtons();
    nameInput.value = ''; urlInput.value = ''; isAdultInput.checked = false; document.getElementById('addCustomApiForm').classList.add('hidden');
    showToast('已更新自定义API: ' + name, 'success');
}

function cancelEditCustomApi() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        document.getElementById('customApiName').value = ''; document.getElementById('customApiUrl').value = '';
        const isAdultInput = document.getElementById('customApiIsAdult'); if (isAdultInput) isAdultInput.checked = false;
        form.classList.add('hidden'); restoreAddCustomApiButtons();
    }
}

function restoreAddCustomApiButtons() {
    const form = document.getElementById('addCustomApiForm'); if (!form) return;
    const buttonContainer = form.querySelector('div:last-child');
    if (buttonContainer) {
        buttonContainer.innerHTML = `
            <button type="button" onclick="addCustomApi()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">添加</button>
            <button type="button" onclick="cancelAddCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs ml-2">取消</button>`;
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
    if (countEl) { countEl.textContent = selectedAPIs.length; }
}

function selectAllAPIs(selectAll = true, excludeAdult = false) {
    const builtInCheckboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"]');
    const customCheckboxes = document.querySelectorAll('#customApisList input[type="checkbox"]');
    builtInCheckboxes.forEach(checkbox => { const isAdult = API_SITES[checkbox.dataset.api]?.adult; if (excludeAdult && isAdult) { checkbox.checked = false; } else { checkbox.checked = selectAll; } });
    customCheckboxes.forEach(checkbox => { const index = parseInt(checkbox.dataset.customIndex); const isAdult = customAPIs[index]?.isAdult; if (excludeAdult && isAdult) { checkbox.checked = false; } else { checkbox.checked = selectAll; } });
    updateSelectedAPIs(); checkAdultAPIsSelected();
}

function showAddCustomApiForm() {
    const form = document.getElementById('addCustomApiForm'); if (form) { form.classList.remove('hidden'); restoreAddCustomApiButtons(); }
}

function cancelAddCustomApi() {
    const form = document.getElementById('addCustomApiForm'); if (form) { form.classList.add('hidden'); document.getElementById('customApiName').value = ''; document.getElementById('customApiUrl').value = ''; const isAdultInput = document.getElementById('customApiIsAdult'); if (isAdultInput) isAdultInput.checked = false; restoreAddCustomApiButtons(); }
}

function addCustomApi() {
    const nameInput = document.getElementById('customApiName'); const urlInput = document.getElementById('customApiUrl'); const isAdultInput = document.getElementById('customApiIsAdult');
    const name = nameInput.value.trim(); let url = urlInput.value.trim(); const isAdult = isAdultInput ? isAdultInput.checked : false;
    if (!name || !url) { showToast('请输入API名称和链接', 'warning'); return; }
    if (!/^https?:\/\/.+/.test(url)) { showToast('API链接格式不正确', 'warning'); return; }
    if (url.endsWith('/')) { url = url.slice(0, -1); }
    const exists = customAPIs.some(api => api.url === url || api.name === name); if (exists) { showToast('已存在相同名称或链接的自定义API', 'warning'); return; }
    customAPIs.push({ name, url, isAdult }); localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    const newApiIndex = customAPIs.length - 1; selectedAPIs.push('custom_' + newApiIndex); localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
    renderCustomAPIsList(); updateSelectedApiCount(); checkAdultAPIsSelected();
    nameInput.value = ''; urlInput.value = ''; isAdultInput.checked = false; document.getElementById('addCustomApiForm').classList.add('hidden'); restoreAddCustomApiButtons();
    showToast('已添加自定义API: ' + name, 'success');
}

function removeCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return; const apiName = customAPIs[index].name;
    if (!confirm(`确定要删除自定义API "${apiName}" 吗？`)) { return; }
    customAPIs.splice(index, 1); localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    const customApiIdToRemove = 'custom_' + index; const newSelectedAPIs = [];
    selectedAPIs.forEach(id => { if (id === customApiIdToRemove) return; if (id.startsWith('custom_')) { const currentIndex = parseInt(id.replace('custom_', '')); if (currentIndex > index) { newSelectedAPIs.push('custom_' + (currentIndex - 1)); } else { newSelectedAPIs.push(id); } } else { newSelectedAPIs.push(id); } });
    selectedAPIs = newSelectedAPIs; localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
    renderCustomAPIsList(); updateSelectedApiCount(); checkAdultAPIsSelected();
    showToast('已移除自定义API: ' + apiName, 'info');
}

function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex); if (isNaN(index) || index < 0 || index >= customAPIs.length) { return null; } return customAPIs[index];
}

// --- 豆瓣推荐功能 (合并自工作示例) ---

// 渲染标签按钮
function renderDoubanTags() {
    const tagContainer = document.getElementById('douban-tags'); // 使用工作示例的 ID
    if (!tagContainer) return;
    tagContainer.innerHTML = ''; // 清空现有标签

    doubanTags.forEach(tag => {
        const btn = document.createElement('button');
        // 使用 text-xs 或 text-sm 控制大小，增加 padding
        btn.className = `douban-tag px-3 py-1 rounded text-xs font-medium mr-1 mb-1 transition ${tag === doubanCurrentTag ? 'douban-tag-active' : 'bg-[#2a2a2a] text-gray-400 border border-transparent hover:bg-[#383838] hover:text-gray-200'}`;
        btn.textContent = tag;
        btn.onclick = function() {
            // 点击标签时，重置页码并加载数据
            if (doubanCurrentTag !== tag) {
                doubanCurrentTag = tag;
                localStorage.setItem('doubanCurrentTag', tag); // 保存当前标签
                doubanPageStart = 0; // 重置页码
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
                renderDoubanTags(); // 重新渲染以更新高亮
            }
        };
        tagContainer.appendChild(btn);
    });
}

// 设置“换一批”按钮的事件监听
function setupDoubanRefreshBtn() {
    const btn = document.getElementById('douban-refresh-btn'); // 使用工作示例的 ID
    if (!btn) return;
    btn.onclick = function() {
        // 点击换一批，增加页码并加载数据
        doubanPageStart += doubanPageSize;
        // 可以加一个最大页数限制，比如豆瓣一般只提供有限页
        if (doubanPageStart >= 90) { // 示例限制
            doubanPageStart = 0; // 超过限制则循环回第一页
            showToast('已从第一页开始加载', 'info');
        }
        renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
    };
}

// 渲染（获取并显示）豆瓣推荐数据
function renderRecommend(tag, pageLimit, pageStart) {
    const container = document.getElementById("douban-results");
    const loading = document.getElementById("loading2"); // 使用工作示例的 ID
    const refreshBtn = document.getElementById('douban-refresh-btn');

    if (!container || !loading) return;

    // 显示加载状态，清空旧内容
    loading.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(loading);
    if (refreshBtn) refreshBtn.disabled = true; // 加载时禁用按钮

    const target = `https://movie.douban.com/j/search_subjects?type=tv&tag=${encodeURIComponent(tag)}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;
    const url = DOUBAN_PROXY + encodeURIComponent(target);

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`豆瓣API响应错误: ${response.status}`);
            return response.json();
        })
        .then(data => {
            loading.style.display = 'none';
            container.innerHTML = ''; // 清空加载指示

            if (!data || !data.subjects || data.subjects.length === 0) {
                container.innerHTML = `<div class="col-span-full text-gray-400 text-center py-10">该分类下没有更多推荐了。</div>`;
                if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '没有更多了'; }
                return;
            }

            const fragment = document.createDocumentFragment();
            data.subjects.forEach(tv => {
                const item = document.createElement("div");
                item.className = "bg-white/5 hover:bg-white/10 transition transform hover:scale-[1.03] rounded-lg overflow-hidden p-2 flex flex-col items-center text-center shadow";
                item.innerHTML = `
                    <button class="relative w-full flex justify-center group active:scale-95 transition transform duration-150 ease-in-out mb-2" onclick="fillAndSearch('${tv.title.replace(/'/g, "\\'")}')" title="搜索 ${tv.title}">
                        <div class="relative w-full aspect-[2/3] overflow-hidden rounded-md bg-black/10">
                            <img src="${proxyImage(tv.cover)}" alt="${tv.title}" class="w-full h-full object-contain" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x300?text=Error'; this.classList.add('object-contain');"/>
                            <div class="absolute bottom-1 left-1 bg-black/70 text-white text-xs font-semibold px-1.5 py-0.5 rounded">评分: ${tv.rate || "N/A"}</div>
                        </div>
                    </button>
                    <a href="${tv.url}" target="_blank" rel="noopener noreferrer" class="w-full block text-sm font-semibold truncate hover:text-cyan-400 mt-1" title="${tv.title}">${tv.title}</a>`;
                fragment.appendChild(item);
            });
            container.appendChild(fragment);

            // 恢复“换一批”按钮状态
            if (refreshBtn) {
                 if (data.subjects.length < pageLimit) { // 如果返回数量小于请求数量，说明是最后一页
                    refreshBtn.disabled = true;
                    refreshBtn.textContent = '没有更多了';
                 } else {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = '换一批';
                 }
            }
        })
        .catch(err => {
            loading.style.display = 'none';
            container.innerHTML = `<div class="col-span-full text-red-400 text-center py-10">❌ 获取推荐数据失败: ${err.message}</div>`;
            console.error(`豆瓣 API 请求失败 (Tag: ${tag}, Start: ${pageStart}):`, err);
            if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '加载失败'; }
        });
}

// 图片代理（可选）
function proxyImage(originalUrl) {
    if (!originalUrl) return '';
    // return `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl.replace(/^https?:\/\//, ''))}&referer=movie.douban.com`;
    return originalUrl;
}

// 点击推荐卡片填充搜索框并搜索
function fillAndSearch(title) {
    const searchInput = document.getElementById('searchInput');
    const doubanSection = document.getElementById("doubanSection");
    const resultsArea = document.getElementById("resultsArea");
    const searchArea = document.getElementById('searchArea');

    if (searchInput) {
        searchInput.value = title;
        search(); // 调用搜索

        // 隐藏豆瓣推荐，显示搜索结果
        if (doubanSection) doubanSection.style.display = "none";
        if (resultsArea) resultsArea.classList.remove('hidden');
        if (searchArea) searchArea.classList.add('mb-8'); // 搜索后给搜索框加点下边距
    }
}

// --- 搜索功能 ---
async function search() {
    // Password check
    if (window.isPasswordProtected && window.isPasswordVerified) { if (!window.isPasswordVerified()) { showPasswordModal && showPasswordModal(); return; } }
    const query = document.getElementById('searchInput').value.trim();
    if (!query) { showToast('请输入搜索内容', 'info'); return; }
    if (selectedAPIs.length === 0) { showToast('请至少选择一个API源', 'warning'); return; }

    showLoading();
    // Hide Douban section
    const doubanSection = document.getElementById("doubanSection");
    if (doubanSection) doubanSection.style.display = "none";

    try {
        saveSearchHistory(query);
        let allResults = [];
        const searchPromises = selectedAPIs.map(async (apiId) => {
            try {
                let apiUrl, apiName, sourceUrl;
                if (apiId.startsWith('custom_')) { const customIndex = apiId.replace('custom_', ''); const customApi = getCustomApiInfo(customIndex); if (!customApi) return []; sourceUrl = customApi.url; apiName = customApi.name; }
                else { if (!API_SITES[apiId]) return []; sourceUrl = API_SITES[apiId].api; apiName = API_SITES[apiId].name; }
                apiUrl = sourceUrl + API_CONFIG.search.path + encodeURIComponent(query);
                const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 8000);
                const response = await fetch(PROXY_URL + encodeURIComponent(apiUrl), { headers: API_CONFIG.search.headers, signal: controller.signal }); clearTimeout(timeoutId);
                if (!response.ok) return []; const data = await response.json();
                if (!data || !data.list || !Array.isArray(data.list)) { if (data && data.code && ![0, 1, 200].includes(data.code)) return []; if (!data || typeof data !== 'object' || (data.list && !Array.isArray(data.list))) return []; }
                return (data.list || []).map(item => ({ ...item, source_name: apiName, source_code: apiId, api_url: apiId.startsWith('custom_') ? sourceUrl : undefined }));
            } catch (error) { if (error.name !== 'AbortError') console.warn(`API ${apiId} search failed:`, error); else console.warn(`API ${apiId} search timed out.`); return []; }
        });

        const resultsArray = await Promise.all(searchPromises);
        allResults = resultsArray.flat();

        document.getElementById('searchArea').classList.add('mb-8');
        document.getElementById('resultsArea').classList.remove('hidden');
        const resultsDiv = document.getElementById('results');

        if (allResults.length === 0) { resultsDiv.innerHTML = `<div class="col-span-full text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3><p class="mt-1 text-sm text-gray-500">请尝试其他关键词或更换数据源</p></div>`; hideLoading(); return; }
        const yellowFilterEnabled = localStorage.getItem('yellowFilterEnabled') === 'true';
        if (yellowFilterEnabled) { const banned = ['伦理片','门事件','萝莉少女','制服诱惑','国产传媒','cosplay','黑丝诱惑','无码','日本无码','有码','日本有码','SWAG','网红主播', '色情片','同性片','福利视频','福利片']; allResults = allResults.filter(item => { const typeName = item.type_name || ''; return !banned.some(keyword => typeName.includes(keyword)); }); }
        if (allResults.length === 0) { resultsDiv.innerHTML = `<div class="col-span-full text-center py-16"><svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><h3 class="mt-2 text-lg font-medium text-gray-400">找到一些结果，但已被内容过滤器隐藏</h3><p class="mt-1 text-sm text-gray-500">您可以在设置中关闭黄色内容过滤</p></div>`; hideLoading(); return; }

        resultsDiv.innerHTML = allResults.map(item => {
            const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
            const safeName = (item.vod_name || '未知标题').toString().replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
            const sourceInfo = item.source_name ? `<span class="bg-[#2a2a2a] text-xs px-2 py-0.5 rounded-full shadow">${item.source_name}</span>` : '';
            const sourceCode = item.source_code || '';
            const apiUrlAttr = item.api_url ? `data-api-url="${item.api_url.replace(/"/g, '"')}"` : '';
            const hasCover = item.vod_pic && item.vod_pic.startsWith('http');
            return `
                <div class="card-hover bg-[#1a1a1a] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg h-full flex flex-col" onclick="showDetails('${safeId}','${safeName}','${sourceCode}')" ${apiUrlAttr}>
                    <div class="flex-shrink-0">
                        ${hasCover ? `<div class="relative overflow-hidden aspect-[2/3] bg-black/10"><img src="${proxyImage(item.vod_pic)}" alt="${safeName}" class="w-full h-full object-cover transition-transform group-hover:scale-105" onerror="this.onerror=null; this.src='https://via.placeholder.com/200x300?text=Error'; this.classList.add('object-contain');" loading="lazy"><div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-80 pointer-events-none"></div></div>` : `<div class="h-48 flex items-center justify-center bg-[#2a2a2a] text-gray-500 aspect-[2/3]">无封面</div>`}
                    </div>
                    <div class="p-3 flex flex-col flex-grow justify-between">
                        <div>
                            <h3 class="text-sm font-semibold mb-1.5 break-words leading-tight h-10 overflow-hidden" title="${safeName}">${safeName}</h3>
                            <div class="flex flex-wrap gap-1 mb-1.5">
                                ${(item.type_name || '').toString().replace(/</g, '<') ? `<span class="text-[10px] py-0.5 px-1.5 rounded bg-blue-500/20 text-blue-300">${(item.type_name || '').toString().replace(/</g, '<')}</span>` : ''}
                                ${(item.vod_year || '') ? `<span class="text-[10px] py-0.5 px-1.5 rounded bg-purple-500/20 text-purple-300">${item.vod_year}</span>` : ''}
                            </div>
                            <p class="text-gray-400 text-xs h-8 overflow-hidden leading-snug" title="${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '<')}">${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '<')}</p>
                        </div>
                        <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-800/50">
                            ${sourceInfo ? `<div class="text-[10px] text-gray-400">${sourceInfo}</div>` : '<div></div>'}
                            <span class="text-xs text-cyan-400 flex items-center opacity-80 group-hover:opacity-100 transition-opacity"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>播放</span>
                        </div>
                    </div>
                </div>`;
        }).join('');

    } catch (error) { console.error('搜索处理错误:', error); showToast('搜索过程中发生错误', 'error');
    } finally { hideLoading(); if (doubanSection && doubanSection.style.display !== "none") doubanSection.style.display = "none"; }
}

// --- 详情和播放函数 ---
async function showDetails(id, vod_name, sourceCode) {
    if (window.isPasswordProtected && window.isPasswordVerified) { if (!window.isPasswordVerified()) { showPasswordModal && showPasswordModal(); return; } }
    if (!id) { showToast('视频ID无效', 'error'); return; }
    showLoading();
    try {
        let apiUrlForDetails; let detailParams = `id=${encodeURIComponent(id)}`; let sourceNameForModal = '未知来源';
        if (sourceCode.startsWith('custom_')) { const customIndex = sourceCode.replace('custom_', ''); const customApi = getCustomApiInfo(customIndex); if (!customApi) { throw new Error('无法找到自定义API配置'); } apiUrlForDetails = customApi.url + API_CONFIG.detail.path; detailParams += `&customApi=${encodeURIComponent(customApi.url)}&source=custom`; sourceNameForModal = customApi.name; }
        else { if (!API_SITES[sourceCode]) { throw new Error('无效的内置API源'); } apiUrlForDetails = API_SITES[sourceCode].api + API_CONFIG.detail.path; detailParams += `&source=${sourceCode}`; sourceNameForModal = API_SITES[sourceCode].name; }
        const fullDetailApiUrl = apiUrlForDetails + id; const fetchUrl = `${PROXY_URL}${encodeURIComponent(fullDetailApiUrl)}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) { let errorMsg = `获取详情失败 (${response.status})`; try { const errData = await response.json(); errorMsg = errData.msg || errData.error || errorMsg; } catch(e) {} throw new Error(errorMsg); }
        const data = await response.json(); const modal = document.getElementById('modal'); const modalTitle = document.getElementById('modalTitle'); const modalContent = document.getElementById('modalContent'); if (!modal || !modalTitle || !modalContent) return;
        const videoInfo = data.videoInfo || (data.list && data.list[0]) || {}; const episodesRaw = data.episodes || videoInfo.vod_play_url || ''; const displayTitle = vod_name || videoInfo.vod_name || '未知视频';
        modalTitle.innerHTML = `<span class="break-words">${displayTitle}</span><span class="text-sm font-normal text-gray-400 ml-2">(${sourceNameForModal})</span>`; currentVideoTitle = displayTitle;
        let processedEpisodes = [];
        if (typeof episodesRaw === 'string' && episodesRaw.includes('$')) { const playSources = episodesRaw.split('$$$'); if (playSources.length > 0) { const mainSource = playSources[0]; processedEpisodes = mainSource.split('#').map(ep => { const parts = ep.split('$'); return parts.length > 1 ? parts[1] : ''; }).filter(url => url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith(PROXY_URL))); } }
        else if (Array.isArray(episodesRaw)) { processedEpisodes = episodesRaw.filter(url => url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith(PROXY_URL))); }
        currentEpisodes = processedEpisodes;
        if (currentEpisodes.length > 0) { episodesReversed = false; modalContent.innerHTML = `<div class="flex justify-end mb-3"><button onclick="toggleEpisodeOrder()" class="px-3 py-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center space-x-1.5 text-xs"><svg id="episodeOrderIcon" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd" /></svg><span id="episodeOrderText">倒序排列</span></button></div><div id="episodesGrid" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2">${renderEpisodes(displayTitle)}</div>`; document.getElementById('episodeOrderIcon').style.transform = ''; }
        else { modalContent.innerHTML = '<p class="text-center text-gray-400 py-8">没有找到可播放的视频剧集</p>'; }
        modal.classList.remove('hidden'); modal.classList.add('flex');
    } catch (error) { console.error('获取详情错误:', error); showToast(`获取详情失败: ${error.message}`, 'error');
    } finally { hideLoading(); }
}

function playVideo(url, vod_name, episodeIndex = 0) {
    if (window.isPasswordProtected && window.isPasswordVerified) { if (!window.isPasswordVerified()) { showPasswordModal && showPasswordModal(); return; } }
    if (!url) { showToast('无效的视频链接', 'error'); return; }
    let sourceName = ''; const modalTitle = document.getElementById('modalTitle'); if (modalTitle) { const sourceSpan = modalTitle.querySelector('span.text-gray-400'); if (sourceSpan) { const match = sourceSpan.textContent.match(/\(([^)]+)\)/); if (match && match[1]) { sourceName = match[1].trim(); } } }
    const videoTitle = vod_name || currentVideoTitle; localStorage.setItem('currentVideoTitle', videoTitle); localStorage.setItem('currentEpisodeIndex', episodeIndex); localStorage.setItem('currentEpisodes', JSON.stringify(currentEpisodes)); localStorage.setItem('episodesReversed', episodesReversed);
    const videoInfo = { title: videoTitle, url: url, episodeIndex: episodeIndex, sourceName: sourceName, timestamp: Date.now(), episodes: currentEpisodes && currentEpisodes.length > 0 ? [...currentEpisodes] : [] };
    if (typeof addToViewingHistory === 'function') { addToViewingHistory(videoInfo); }
    const playerUrl = `player.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(videoTitle)}&index=${episodeIndex}&source=${encodeURIComponent(sourceName)}`;
    window.open(playerUrl, '_blank');
}

function playPreviousEpisode() {
    if (currentEpisodeIndex > 0) { const prevIndex = currentEpisodeIndex - 1; if (currentEpisodes && currentEpisodes[prevIndex]) { const prevUrl = currentEpisodes[prevIndex]; playVideo(prevUrl, currentVideoTitle, prevIndex); } }
}

function playNextEpisode() {
    if (currentEpisodes && currentEpisodeIndex < currentEpisodes.length - 1) { const nextIndex = currentEpisodeIndex + 1; if (currentEpisodes[nextIndex]) { const nextUrl = currentEpisodes[nextIndex]; playVideo(nextUrl, currentVideoTitle, nextIndex); } }
}

function handlePlayerError() { hideLoading(); showToast('视频播放加载失败', 'error'); }

function renderEpisodes(vodName) {
    const safeVodName = String(vodName || ''); const episodes = episodesReversed ? [...currentEpisodes].reverse() : currentEpisodes;
    if (!Array.isArray(episodes) || episodes.length === 0) return '<p class="col-span-full text-center text-gray-500 text-sm">无剧集信息</p>';
    return episodes.map((episode, index) => {
        const realIndex = episodesReversed ? currentEpisodes.length - 1 - index : index; if (!episode || typeof episode !== 'string') return ''; const escapedVodName = safeVodName.replace(/'/g, "\\'");
        return `<button id="episode-${realIndex}" onclick="playVideo('${episode}', '${escapedVodName}', ${realIndex})" class="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#383838] border border-[#444] rounded-md transition-colors text-center text-xs text-gray-300 truncate episode-btn focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50" title="播放 第${realIndex + 1}集">第 ${realIndex + 1} 集</button>`;
    }).join('');
}

function toggleEpisodeOrder() {
    episodesReversed = !episodesReversed; const episodesGrid = document.getElementById('episodesGrid'); if (episodesGrid) { episodesGrid.innerHTML = renderEpisodes(currentVideoTitle); }
    const toggleBtn = document.querySelector('button[onclick="toggleEpisodeOrder()"]'); if (toggleBtn) { const textSpan = toggleBtn.querySelector('span'); const icon = toggleBtn.querySelector('svg'); if (textSpan) textSpan.textContent = episodesReversed ? '正序排列' : '倒序排列'; if (icon) icon.style.transform = episodesReversed ? 'rotate(180deg)' : 'rotate(0deg)'; }
}

// --- 其他辅助函数 ---
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput'); if (searchInput) { searchInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') search(); }); }
    document.addEventListener('click', function(e) {
        const settingsPanel = document.getElementById('settingsPanel'); const historyPanel = document.getElementById('historyPanel'); const settingsButton = document.querySelector('button[onclick="toggleSettings(event)"]'); const historyButton = document.querySelector('button[onclick="toggleHistory(event)"]');
        if (settingsPanel && settingsButton && !settingsPanel.contains(e.target) && !settingsButton.contains(e.target) && settingsPanel.classList.contains('show')) { toggleSettings(); }
        if (historyPanel && historyButton && !historyPanel.contains(e.target) && !historyButton.contains(e.target) && historyPanel.classList.contains('show')) { toggleHistory(); }
    });
    const yellowFilterToggle = document.getElementById('yellowFilterToggle'); if (yellowFilterToggle) { yellowFilterToggle.addEventListener('change', function(e) { localStorage.setItem('yellowFilterEnabled', e.target.checked); }); }
    const adFilterToggle = document.getElementById('adFilterToggle'); if (adFilterToggle) { adFilterToggle.addEventListener('change', function(e) { localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, e.target.checked); }); }
}

function resetSearchArea() {
    const resultsDiv = document.getElementById('results'); const searchInput = document.getElementById('searchInput'); const searchArea = document.getElementById('searchArea'); const resultsArea = document.getElementById('resultsArea'); const doubanSection = document.getElementById("doubanSection"); const footer = document.querySelector('.footer');
    if (resultsDiv) resultsDiv.innerHTML = ''; if (searchInput) searchInput.value = ''; if (searchArea) searchArea.classList.remove('mb-8'); if (resultsArea) resultsArea.classList.add('hidden');
    if (doubanSection) doubanSection.style.display = "block"; // Restore Douban
    if (footer) { footer.style.position = ''; }
    // Optionally, reload the default Douban category after clearing search
    // renderRecommend(doubanCurrentTag, doubanPageSize, 0);
    // updateActiveTagButton(doubanCurrentTag);
}

function checkPasswordProtection() {
    if (window.isPasswordProtected && window.isPasswordVerified) { if (window.isPasswordProtected() && !window.isPasswordVerified()) { showPasswordModal && showPasswordModal(); } }
}
