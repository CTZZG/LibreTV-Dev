// js/app.js (完整修改版，包含豆瓣分类和换一批功能)

// 全局变量
let selectedAPIs = JSON.parse(localStorage.getItem('selectedAPIs') || '["heimuer"]'); // 默认选中黑木耳
let customAPIs = JSON.parse(localStorage.getItem('customAPIs') || '[]'); // 存储自定义API列表

// 添加当前播放的集数索引
let currentEpisodeIndex = 0;
// 添加当前视频的所有集数
let currentEpisodes = [];
// 添加当前视频的标题
let currentVideoTitle = '';
// 全局变量用于倒序状态
let episodesReversed = false;

// --- 新增：豆瓣推荐相关状态 ---
let currentDoubanTag = '%E7%83%AD%E9%97%A8'; // 默认为"热门"的 URL 编码
let currentDoubanPage = 0; // 当前页码，从 0 开始
const doubanPageLimit = 30; // 每页数量，与 API 匹配
let isFetchingDouban = false; // 防止重复请求的标志
// --- 结束：豆瓣推荐相关状态 ---


// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化API复选框
    initAPICheckboxes();

    // 初始化自定义API列表
    renderCustomAPIsList();

    // 初始化显示选中的API数量
    updateSelectedApiCount();

    // 渲染搜索历史
    renderSearchHistory();

    // 设置默认API选择（如果是第一次加载）
    if (!localStorage.getItem('hasInitializedDefaults')) {
        // 仅选择黑木耳源
        selectedAPIs = ["heimuer"];
        localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

        // 默认选中过滤开关
        localStorage.setItem('yellowFilterEnabled', 'true');
        localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, 'true');

        // 标记已初始化默认值
        localStorage.setItem('hasInitializedDefaults', 'true');
    }

    // 设置黄色内容过滤开关初始状态
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.checked = localStorage.getItem('yellowFilterEnabled') === 'true';
    }

    // 设置广告过滤开关初始状态
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.checked = localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== 'false'; // 默认为true
    }

    // 设置事件监听器
    setupEventListeners();

    // 初始检查成人API选中状态
    setTimeout(checkAdultAPIsSelected, 100);

    // 初始加载豆瓣数据
    fetchDoubanTV();
});

// 初始化API复选框
function initAPICheckboxes() {
    const container = document.getElementById('apiCheckboxes');
    if (!container) return; // 添加检查，如果容器不存在则退出
    container.innerHTML = '';

    // 添加普通API组标题
    const normalTitle = document.createElement('div');
    normalTitle.className = 'api-group-title';
    normalTitle.textContent = '普通资源';
    container.appendChild(normalTitle);

    // 创建普通API源的复选框
    Object.keys(API_SITES).forEach(apiKey => {
        const api = API_SITES[apiKey];
        if (!api || api.adult) return; // 跳过成人内容API或无效API

        const checked = selectedAPIs.includes(apiKey);

        const checkbox = document.createElement('div');
        checkbox.className = 'flex items-center';
        checkbox.innerHTML = `
            <input type="checkbox" id="api_${apiKey}"
                   class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333]"
                   ${checked ? 'checked' : ''}
                   data-api="${apiKey}">
            <label for="api_${apiKey}" class="ml-1 text-xs text-gray-400 truncate">${api.name || apiKey}</label> <!-- 添加默认名称 -->
        `;
        container.appendChild(checkbox);

        // 添加事件监听器
        const inputElement = checkbox.querySelector('input');
        if (inputElement) {
            inputElement.addEventListener('change', function() {
                updateSelectedAPIs();
                checkAdultAPIsSelected();
            });
        }
    });

    // 仅在隐藏设置为false时添加成人API组 (假设 HIDE_BUILTIN_ADULT_APIS 在 config.js 中定义)
    if (typeof HIDE_BUILTIN_ADULT_APIS === 'undefined' || !HIDE_BUILTIN_ADULT_APIS) {
        // 添加成人API组标题
        const adultTitle = document.createElement('div');
        adultTitle.className = 'api-group-title adult';
        adultTitle.innerHTML = `黄色资源采集站 <span class="adult-warning">
            <svg xmlns="http://www.w3.org/2000/svg" class="inline-block w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </span>`;
        container.appendChild(adultTitle);

        // 创建成人API源的复选框
        Object.keys(API_SITES).forEach(apiKey => {
            const api = API_SITES[apiKey];
            if (!api || !api.adult) return; // 仅添加成人内容API或有效API

            const checked = selectedAPIs.includes(apiKey);

            const checkbox = document.createElement('div');
            checkbox.className = 'flex items-center';
            checkbox.innerHTML = `
                <input type="checkbox" id="api_${apiKey}"
                       class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333] api-adult"
                       ${checked ? 'checked' : ''}
                       data-api="${apiKey}">
                <label for="api_${apiKey}" class="ml-1 text-xs text-pink-400 truncate">${api.name || apiKey}</label> <!-- 添加默认名称 -->
            `;
            container.appendChild(checkbox);

            // 添加事件监听器
            const inputElement = checkbox.querySelector('input');
            if (inputElement) {
                inputElement.addEventListener('change', function() {
                    updateSelectedAPIs();
                    checkAdultAPIsSelected();
                });
            }
        });
    }

    // 初始检查成人内容状态
    checkAdultAPIsSelected();
}

// 检查是否有成人API被选中
function checkAdultAPIsSelected() {
    const adultBuiltinCheckboxes = document.querySelectorAll('#apiCheckboxes .api-adult:checked');
    const customApiCheckboxes = document.querySelectorAll('#customApisList .api-adult:checked');
    const hasAdultSelected = adultBuiltinCheckboxes.length > 0 || customApiCheckboxes.length > 0;

    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (!yellowFilterToggle) return; // 如果开关不存在则退出

    const yellowFilterContainer = yellowFilterToggle.closest('div.relative')?.parentNode?.parentNode; // 向上查找容器
    if (!yellowFilterContainer) return;

    const filterDescription = yellowFilterContainer.querySelector('p.filter-description');

    if (hasAdultSelected) {
        yellowFilterToggle.checked = false;
        yellowFilterToggle.disabled = true;
        localStorage.setItem('yellowFilterEnabled', 'false');
        yellowFilterContainer.classList.add('filter-disabled', 'opacity-50', 'cursor-not-allowed'); // 添加更多禁用样式
        if (filterDescription) {
            filterDescription.innerHTML = '<strong class="text-pink-300">选中黄色资源站时无法启用此过滤</strong>';
        }
    } else {
        yellowFilterToggle.disabled = false;
        yellowFilterContainer.classList.remove('filter-disabled', 'opacity-50', 'cursor-not-allowed'); // 移除禁用样式
        if (filterDescription) {
            filterDescription.innerHTML = '过滤"伦理片"等黄色内容';
        }
        // 恢复用户之前的选择（如果之前没选中成人API）
        yellowFilterToggle.checked = localStorage.getItem('yellowFilterEnabled') === 'true';
    }
}

// 渲染自定义API列表
function renderCustomAPIsList() {
    const container = document.getElementById('customApisList');
    if (!container) return;

    if (customAPIs.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>';
        return;
    }

    container.innerHTML = '';
    customAPIs.forEach((api, index) => {
        const apiItem = document.createElement('div');
        apiItem.className = 'flex items-center justify-between p-1 mb-1 bg-[#222] rounded';
        const textColorClass = api.isAdult ? 'text-pink-400' : 'text-white';
        const adultTag = api.isAdult ? '<span class="text-xs text-pink-400 mr-1">(18+)</span>' : '';

        apiItem.innerHTML = `
            <div class="flex items-center flex-1 min-w-0 mr-1"> <!-- 添加 mr-1 -->
                <input type="checkbox" id="custom_api_${index}"
                       class="form-checkbox h-3 w-3 text-blue-600 mr-1 flex-shrink-0 ${api.isAdult ? 'api-adult' : ''}" <!-- 添加 flex-shrink-0 -->
                       ${selectedAPIs.includes('custom_' + index) ? 'checked' : ''}
                       data-custom-index="${index}">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium ${textColorClass} truncate" title="${api.name}">
                        ${adultTag}${api.name}
                    </div>
                    <div class="text-xs text-gray-500 truncate" title="${api.url}">${api.url}</div>
                </div>
            </div>
            <div class="flex items-center flex-shrink-0"> <!-- 添加 flex-shrink-0 -->
                <button class="text-blue-500 hover:text-blue-700 text-xs px-1" onclick="editCustomApi(${index})" title="编辑">✎</button>
                <button class="text-red-500 hover:text-red-700 text-xs px-1" onclick="removeCustomApi(${index})" title="删除">✕</button>
            </div>
        `;
        container.appendChild(apiItem);

        const inputElement = apiItem.querySelector('input');
        if (inputElement) {
            inputElement.addEventListener('change', function() {
                updateSelectedAPIs();
                checkAdultAPIsSelected();
            });
        }
    });
}

// 编辑自定义API
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
            <button type="button" onclick="cancelEditCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
        `;
    }
}

// 更新自定义API
function updateCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const isAdultInput = document.getElementById('customApiIsAdult');

    if (!nameInput || !urlInput || !isAdultInput) return;

    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const isAdult = isAdultInput.checked;

    if (!name || !url) { showToast('请输入API名称和链接', 'warning'); return; }
    if (!/^https?:\/\/.+/.test(url)) { showToast('API链接格式不正确', 'warning'); return; }
    if (url.endsWith('/')) { url = url.slice(0, -1); }

    customAPIs[index] = { name, url, isAdult };
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));
    renderCustomAPIsList();
    checkAdultAPIsSelected(); // 重新检查状态
    cancelEditCustomApi(); // 使用取消函数来重置表单和按钮
    showToast('已更新自定义API: ' + name, 'success');
}

// 取消编辑/添加自定义API
function cancelEditCustomApi() {
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const isAdultInput = document.getElementById('customApiIsAdult');
    const form = document.getElementById('addCustomApiForm');

    if (nameInput) nameInput.value = '';
    if (urlInput) urlInput.value = '';
    if (isAdultInput) isAdultInput.checked = false;
    if (form) form.classList.add('hidden');

    restoreAddCustomApiButtons(); // 恢复按钮状态
}

// 恢复自定义API添加按钮
function restoreAddCustomApiButtons() {
    const form = document.getElementById('addCustomApiForm');
    if (!form) return;
    const buttonContainer = form.querySelector('div:last-child');
    if (buttonContainer) {
        buttonContainer.innerHTML = `
            <button type="button" onclick="addCustomApi()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">添加</button>
            <button type="button" onclick="cancelAddCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
        `;
    }
}

// 更新选中的API列表
function updateSelectedAPIs() {
    const builtInApiCheckboxes = document.querySelectorAll('#apiCheckboxes input:checked');
    const builtInApis = Array.from(builtInApiCheckboxes).map(input => input.dataset.api);
    const customApiCheckboxes = document.querySelectorAll('#customApisList input:checked');
    const customApiIndices = Array.from(customApiCheckboxes).map(input => 'custom_' + input.dataset.customIndex);
    selectedAPIs = [...builtInApis, ...customApiIndices];
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
    updateSelectedApiCount();
}

// 更新选中的API数量显示
function updateSelectedApiCount() {
    const countEl = document.getElementById('selectedApiCount');
    if (countEl) {
        countEl.textContent = selectedAPIs.length;
    }
}

// 全选或取消全选API
function selectAllAPIs(selectAll = true, excludeAdult = false) {
    const checkboxes = document.querySelectorAll('#apiCheckboxes input[type="checkbox"], #customApisList input[type="checkbox"]'); // 同时选择内置和自定义
    checkboxes.forEach(checkbox => {
        // 检查是否是成人API（内置或自定义）
        const isAdult = checkbox.classList.contains('api-adult');
        if (excludeAdult && isAdult) {
            checkbox.checked = false;
        } else {
            checkbox.checked = selectAll;
        }
    });
    updateSelectedAPIs();
    checkAdultAPIsSelected(); // 检查成人API选中状态
}

// 显示添加自定义API表单
function showAddCustomApiForm() {
    const form = document.getElementById('addCustomApiForm');
    if (form) {
        form.classList.remove('hidden');
        restoreAddCustomApiButtons(); // 确保是添加按钮
    }
}

// 取消添加自定义API
function cancelAddCustomApi() {
    cancelEditCustomApi(); // 复用取消编辑的逻辑
}

// 添加自定义API
function addCustomApi() {
    const nameInput = document.getElementById('customApiName');
    const urlInput = document.getElementById('customApiUrl');
    const isAdultInput = document.getElementById('customApiIsAdult');

    if (!nameInput || !urlInput || !isAdultInput) return;

    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    const isAdult = isAdultInput.checked;

    if (!name || !url) { showToast('请输入API名称和链接', 'warning'); return; }
    if (!/^https?:\/\/.+/.test(url)) { showToast('API链接格式不正确', 'warning'); return; }
    if (url.endsWith('/')) { url = url.slice(0, -1); }

    customAPIs.push({ name, url, isAdult });
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

    const newApiIndex = customAPIs.length - 1;
    if (!selectedAPIs.includes('custom_' + newApiIndex)) { // 避免重复添加
       selectedAPIs.push('custom_' + newApiIndex);
       localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
    }


    renderCustomAPIsList();
    updateSelectedApiCount();
    checkAdultAPIsSelected(); // 检查状态
    cancelAddCustomApi(); // 清空并隐藏表单
    showToast('已添加自定义API: ' + name, 'success');
}

// 移除自定义API
function removeCustomApi(index) {
    if (index < 0 || index >= customAPIs.length) return;
    const apiName = customAPIs[index].name;

    // 确认删除
    if (!confirm(`确定要删除自定义API "${apiName}" 吗？`)) {
        return;
    }

    customAPIs.splice(index, 1);
    localStorage.setItem('customAPIs', JSON.stringify(customAPIs));

    const customApiId = 'custom_' + index;
    selectedAPIs = selectedAPIs.filter(id => id !== customApiId);
    selectedAPIs = selectedAPIs.map(id => {
        if (id.startsWith('custom_')) {
            const currentIndex = parseInt(id.replace('custom_', ''));
            if (currentIndex > index) { return 'custom_' + (currentIndex - 1); }
        }
        return id;
    });
    localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

    renderCustomAPIsList();
    updateSelectedApiCount();
    checkAdultAPIsSelected(); // 检查状态
    showToast('已移除自定义API: ' + apiName, 'info');
}

// 设置事件监听器
function setupEventListeners() {
    // 回车搜索
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                search();
            }
        });
    }

    // 点击外部关闭面板
    document.addEventListener('click', function(e) {
        const settingsPanel = document.getElementById('settingsPanel');
        const settingsButton = document.querySelector('button[onclick="toggleSettings(event)"]');
        const historyPanel = document.getElementById('historyPanel');
        const historyButton = document.querySelector('button[onclick="toggleHistory(event)"]');

        // 关闭设置面板
        if (settingsPanel && settingsButton && settingsPanel.classList.contains('show') &&
            !settingsPanel.contains(e.target) && !settingsButton.contains(e.target)) {
            settingsPanel.classList.remove('show');
        }
        // 关闭历史面板
        if (historyPanel && historyButton && historyPanel.classList.contains('show') &&
            !historyPanel.contains(e.target) && !historyButton.contains(e.target)) {
            historyPanel.classList.remove('show');
            // 使历史面板回到屏幕外
             historyPanel.classList.add('-translate-x-full');
        }
    });

    // 过滤开关事件
    const yellowFilterToggle = document.getElementById('yellowFilterToggle');
    if (yellowFilterToggle) {
        yellowFilterToggle.addEventListener('change', function(e) {
            localStorage.setItem('yellowFilterEnabled', e.target.checked);
            // 注意：如果因为选中成人API而被禁用，这里不会触发UI更新，由 checkAdultAPIsSelected 控制
        });
    }
    const adFilterToggle = document.getElementById('adFilterToggle');
    if (adFilterToggle) {
        adFilterToggle.addEventListener('change', function(e) {
            localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, e.target.checked);
        });
    }

    // --- 豆瓣分类按钮事件监听 ---
    const doubanControls = document.getElementById('douban-controls');
    if (doubanControls) {
        doubanControls.addEventListener('click', function(event) {
            if (event.target.classList.contains('douban-category-btn')) {
                event.preventDefault();
                if (isFetchingDouban) return;

                const button = event.target;
                const newTag = button.dataset.tag;
                if (newTag === currentDoubanTag) return;

                currentDoubanTag = newTag;
                currentDoubanPage = 0;

                // 更新按钮样式
                const allButtons = doubanControls.querySelectorAll('.douban-category-btn');
                allButtons.forEach(btn => {
                    btn.classList.remove('active', 'bg-pink-600');
                    btn.classList.add('bg-gray-700', 'hover:bg-gray-600', 'text-gray-300');
                });
                button.classList.add('active', 'bg-pink-600');
                button.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'text-gray-300');

                fetchDoubanTV();
            } else if (event.target.id === 'nextBatchBtn' || event.target.closest('#nextBatchBtn')) {
                event.preventDefault();
                if (isFetchingDouban) return;
                currentDoubanPage++;
                fetchDoubanTV();
            }
        });
    }
}

// 重置搜索区域
function resetSearchArea() {
    const resultsDiv = document.getElementById('results');
    const searchInput = document.getElementById('searchInput');
    const searchArea = document.getElementById('searchArea');
    const resultsArea = document.getElementById('resultsArea');
    const footer = document.querySelector('.footer');
    // --- 新增：显示豆瓣推荐 ---
    const doubanContainer = document.getElementById("douban-results");
    const doubanControls = document.getElementById("douban-controls");

    if (resultsDiv) resultsDiv.innerHTML = '';
    if (searchInput) searchInput.value = '';
    if (searchArea) {
        searchArea.classList.add('flex-1');
        searchArea.classList.remove('mb-8');
    }
    if (resultsArea) resultsArea.classList.add('hidden');
    if (footer) footer.style.position = '';
    // --- 新增：显示豆瓣推荐 ---
    if (doubanContainer) doubanContainer.style.display = "grid"; // 恢复为 grid 显示
    if (doubanControls) doubanControls.style.display = "flex";  // 恢复为 flex 显示
}

// 获取自定义API信息
function getCustomApiInfo(customApiIndex) {
    const index = parseInt(customApiIndex);
    if (isNaN(index) || index < 0 || index >= customAPIs.length) { return null; }
    return customAPIs[index];
}

// 搜索功能 - 隐藏豆瓣推荐
async function search() {
    // 密码保护校验 (如果需要)
    // if (window.isPasswordProtected && window.isPasswordVerified && window.isPasswordProtected() && !window.isPasswordVerified()) { showPasswordModal && showPasswordModal(); return; }

    const query = document.getElementById('searchInput').value.trim();
    if (!query) { showToast('请输入搜索内容', 'info'); return; }
    if (selectedAPIs.length === 0) { showToast('请至少选择一个API源', 'warning'); return; }

    showLoading();

    // --- 隐藏豆瓣推荐 ---
    const doubanContainer = document.getElementById("douban-results");
    const doubanControls = document.getElementById("douban-controls");
    if (doubanContainer) doubanContainer.style.display = "none";
    if (doubanControls) doubanControls.style.display = "none";
    // ---

    try {
        saveSearchHistory(query);

        let allResults = [];
        const searchPromises = selectedAPIs.map(async (apiId) => {
            try {
                let apiUrl = '', apiName = '', sourceUrl = ''; // 添加 sourceUrl 用于详情
                let isCustom = apiId.startsWith('custom_');

                if (isCustom) {
                    const customIndex = apiId.replace('custom_', '');
                    const customApi = getCustomApiInfo(customIndex);
                    if (!customApi) return [];
                    sourceUrl = customApi.url; // 保存基础 URL
                    apiUrl = sourceUrl + API_CONFIG.search.path + encodeURIComponent(query);
                    apiName = customApi.name;
                } else {
                    if (!API_SITES[apiId]) return [];
                    sourceUrl = API_SITES[apiId].api; // 保存基础 URL
                    apiUrl = sourceUrl + API_CONFIG.search.path + encodeURIComponent(query);
                    apiName = API_SITES[apiId].name;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                // 确保 PROXY_URL 在 config.js 中定义
                const response = await fetch(PROXY_URL + encodeURIComponent(apiUrl), {
                    headers: API_CONFIG.search.headers, // 确保 API_CONFIG 在 config.js 中定义
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    console.warn(`API ${apiId} (${apiName}) 请求失败: ${response.status}`);
                    return []; // 请求失败返回空
                }

                let data;
                try {
                    data = await response.json();
                } catch (jsonError) {
                     console.warn(`API ${apiId} (${apiName}) 返回非JSON:`, await response.text());
                     return []; // JSON 解析失败返回空
                }


                if (!data || !data.list || !Array.isArray(data.list)) { // 允许空列表 data.list.length === 0
                     console.warn(`API ${apiId} (${apiName}) 返回无效数据结构:`, data);
                     return []; // 数据结构无效返回空
                }


                // 添加源信息和基础 API URL
                return data.list.map(item => ({
                    ...item,
                    source_name: apiName,
                    source_code: apiId,
                    api_base_url: sourceUrl // 添加基础URL，用于详情请求
                }));

            } catch (error) {
                if (error.name !== 'AbortError') { // 超时不作为严重错误警告
                   console.warn(`API ${apiId} 搜索时出错:`, error);
                }
                return []; // 任何错误都返回空数组
            }
        });

        const resultsArray = await Promise.all(searchPromises);
        allResults = resultsArray.flat(); // 使用 flat 合并

        // --- 结果处理和渲染 ---
        const resultsArea = document.getElementById('resultsArea');
        const searchArea = document.getElementById('searchArea');
        const resultsDiv = document.getElementById('results');
        if (!resultsArea || !searchArea || !resultsDiv) return; // 确保元素存在

        searchArea.classList.remove('flex-1');
        searchArea.classList.add('mb-8');
        resultsArea.classList.remove('hidden');

        if (allResults.length === 0) {
            resultsDiv.innerHTML = `
                <div class="col-span-full text-center py-16">
                    {/* ... 无结果 SVG 和文字 ... */}
                    <h3 class="mt-2 ...">所有选中源均无匹配结果</h3>
                    <p class="mt-1 ...">请尝试其他关键词或检查数据源选择</p>
                </div>`;
            hideLoading();
            return;
        }

        // 黄色内容过滤
        const yellowFilterEnabled = localStorage.getItem('yellowFilterEnabled') === 'true';
        let filteredResults = allResults;
        if (yellowFilterEnabled) {
            const banned = ['伦理片','门事件','萝莉少女','制服诱惑','国产传媒','cosplay','黑丝诱惑','无码','日本无码','有码','日本有码','SWAG','网红主播', '色情片','同性片','福利视频','福利片']; // 确保是最新列表
            filteredResults = allResults.filter(item => {
                const typeName = item.type_name || '';
                // 使用 some 优化判断
                return !banned.some(keyword => typeName.includes(keyword));
            });
             if (filteredResults.length === 0 && allResults.length > 0) {
                 // 如果过滤后结果为空，但原始结果不为空
                 resultsDiv.innerHTML = `
                    <div class="col-span-full text-center py-16">
                        {/* ... 图标 ... */}
                        <h3 class="mt-2 ...">找到的结果已被过滤</h3>
                        <p class="mt-1 ...">请关闭“黄色内容过滤”开关或尝试其他关键词。</p>
                    </div>`;
                hideLoading();
                return;
             }

        }

        // 渲染结果卡片
        resultsDiv.innerHTML = filteredResults.map(item => {
            const safeId = item.vod_id ? item.vod_id.toString().replace(/[^\w-]/g, '') : '';
            const safeName = (item.vod_name || '').toString().replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
            const sourceInfo = item.source_name ? `<span class="bg-[#222] text-xs px-2 py-1 rounded-full">${item.source_name}</span>` : '';
            const sourceCode = item.source_code || '';
            // **传递 api_base_url 给 showDetails**
            const apiBaseUrlAttr = item.api_base_url ? `data-api-base-url="${item.api_base_url.replace(/"/g, '"')}"` : '';

            const hasCover = item.vod_pic && item.vod_pic.startsWith('http');

            return `
                <div class="card-hover bg-[#111] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] h-full"
                     onclick="showDetails('${safeId}','${safeName}','${sourceCode}', this.dataset.apiBaseUrl)" ${apiBaseUrlAttr}>
                    <div class="md:flex">
                        ${hasCover ? `
                        <div class="md:w-1/4 relative overflow-hidden aspect-[2/3] bg-black/20"> <!-- 使用 aspect-ratio 和 object-contain -->
                            <div class="w-full h-full">
                                <img src="${item.vod_pic}" alt="${safeName}"
                                     class="w-full h-full object-contain transition-transform hover:scale-110"
                                     onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=无封面'; this.classList.add('object-contain');"
                                     loading="lazy">
                            </div>
                        </div>` : `
                        <div class="md:w-1/4 relative overflow-hidden aspect-[2/3] bg-[#222] flex items-center justify-center"> <!-- 无封面占位 -->
                             <svg class="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                        `}

                        <div class="p-3 flex flex-col flex-grow ${hasCover ? 'md:w-3/4' : 'w-full'}">
                            <div class="flex-grow">
                                <h3 class="text-lg font-semibold mb-2 break-words" title="${safeName}">${safeName}</h3> {/* 添加 title 属性 */}
                                <div class="flex flex-wrap gap-1 mb-2">
                                    ${(item.type_name || '').toString().replace(/</g, '<') ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">${(item.type_name || '').toString().replace(/</g, '<')}</span>` : ''}
                                    ${(item.vod_year || '') ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-purple-500 text-purple-300">${item.vod_year}</span>` : ''}
                                </div>
                                <p class="text-gray-400 text-xs h-9 overflow-hidden" title="${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '<')}"> {/* 添加 title */}
                                    ${(item.vod_remarks || '暂无介绍').toString().replace(/</g, '<')}
                                </p>
                            </div>
                            <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-800">
                                ${sourceInfo ? `<div>${sourceInfo}</div>` : '<div></div>'}
                                <div><span class="text-xs text-gray-500 flex items-center">{/* ... 点击播放 SVG ... */} 点击播放</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('搜索错误:', error);
        if (error.name === 'AbortError') { showToast('搜索请求超时', 'error'); }
        else { showToast('搜索失败', 'error'); }
    } finally {
        hideLoading();
    }
}


// 显示详情 - 修改为接收 apiBaseUrl
async function showDetails(id, vod_name, sourceCode, apiBaseUrl = '') { // 添加 apiBaseUrl 参数
    // ... (密码校验不变) ...
    if (!id) { /* ... */ return; }
    showLoading();

    try {
        let detailApiUrl = '';
        let sourceName = '';

        if (sourceCode.startsWith('custom_')) {
            // 对于自定义源，apiBaseUrl 就是需要的 URL
            if (!apiBaseUrl) {
                 const customIndex = sourceCode.replace('custom_', '');
                 const customApi = getCustomApiInfo(customIndex);
                 if (!customApi) { throw new Error('自定义API配置无效'); }
                 apiBaseUrl = customApi.url;
                 sourceName = customApi.name;
            } else {
                 // 如果 apiBaseUrl 传递过来了，尝试从中获取名字
                 const customApi = customAPIs.find(api => api.url === apiBaseUrl);
                 sourceName = customApi ? customApi.name : '自定义源';
            }
             // 确保 API_CONFIG.detail.path 存在
             detailApiUrl = apiBaseUrl + (API_CONFIG?.detail?.path || '/api.php/provide/vod/?ac=videolist&ids=') + encodeURIComponent(id);
        } else {
            // 内置 API
             if (!API_SITES[sourceCode]) { throw new Error('无效的内置API源'); }
             apiBaseUrl = API_SITES[sourceCode].api; // 获取基础 URL
             detailApiUrl = apiBaseUrl + (API_CONFIG?.detail?.path || '/api.php/provide/vod/?ac=videolist&ids=') + encodeURIComponent(id);
             sourceName = API_SITES[sourceCode].name;
        }

        // 使用代理请求详情 API
        const response = await fetch(PROXY_URL + encodeURIComponent(detailApiUrl)); // 确保 PROXY_URL 定义

        if (!response.ok) {
            throw new Error(`详情请求失败: ${response.status}`);
        }

         let data;
         try {
            data = await response.json();
         } catch(jsonError) {
             throw new Error('详情接口返回非JSON格式');
         }


        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        if (!modal || !modalTitle || !modalContent) return;


        const displaySourceName = sourceName ? ` <span class="text-sm font-normal text-gray-400">(${sourceName})</span>` : '';
        modalTitle.innerHTML = `<span class="break-words">${vod_name || data?.list?.[0]?.vod_name || '未知视频'}</span>${displaySourceName}`;
        currentVideoTitle = vod_name || data?.list?.[0]?.vod_name || '未知视频';

        // --- 提取剧集 ---
        let episodes = [];
        const videoDetail = data?.list?.[0];

        if (videoDetail?.vod_play_url) {
            // ... (提取 vod_play_url 的逻辑不变) ...
             const playSources = videoDetail.vod_play_url.split('$$$');
             if (playSources.length > 0) {
                 const mainSource = playSources[0];
                 const episodeList = mainSource.split('#');
                 episodes = episodeList.map(ep => {
                     const parts = ep.split('$');
                     return parts.length > 1 ? parts[1] : '';
                 }).filter(url => url && (url.startsWith('http://') || url.startsWith('https://')));
             }
        } else if (videoDetail?.vod_content) {
            // ... (尝试从 vod_content 提取 m3u8 的逻辑不变) ...
             const contentMatches = videoDetail.vod_content.match(M3U8_PATTERN) || []; // 确保 M3U8_PATTERN 定义
             episodes = contentMatches.map(link => link.replace(/^\$/, ''));
        }

        currentEpisodes = episodes; // 直接使用从 API 获取的链接（代理会在播放时处理）
        episodesReversed = false;

        if (currentEpisodes.length > 0) {
            modalContent.innerHTML = `
                <div class="flex justify-end mb-2">
                    <button onclick="toggleEpisodeOrder()" class="px-4 py-2 ...">...</button>
                </div>
                <div id="episodesGrid" class="grid ...">
                    ${renderEpisodes(currentVideoTitle)} {/* 使用 currentVideoTitle */}
                </div>
            `;
        } else {
            modalContent.innerHTML = '<p class="text-center ...">没有找到可播放的视频</p>';
        }

        modal.classList.remove('hidden');

    } catch (error) {
        console.error('获取详情错误:', error);
        showToast(`获取详情失败: ${error.message}`, 'error'); // 显示更具体的错误
    } finally {
        hideLoading();
    }
}

// 播放视频函数
function playVideo(url, vod_name, episodeIndex = 0) {
    // ... (密码校验) ...
    if (!url) { /* ... */ return; }

    let sourceName = '';
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) { /* ... 提取 sourceName ... */ }

    localStorage.setItem('currentVideoTitle', currentVideoTitle);
    localStorage.setItem('currentEpisodeIndex', episodeIndex);
    localStorage.setItem('currentEpisodes', JSON.stringify(currentEpisodes));
    localStorage.setItem('episodesReversed', episodesReversed);

    const videoTitle = vod_name || currentVideoTitle;
    const videoInfo = { /* ... videoInfo 对象 ... */ };
    if (typeof addToViewingHistory === 'function') { addToViewingHistory(videoInfo); }

    // 播放链接已经是代理链接或原始链接，player.html 会处理
    const playerUrl = `player.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(videoTitle)}&index=${episodeIndex}&source=${encodeURIComponent(sourceName)}`;
    window.open(playerUrl, '_blank');
}

// 播放上一集 (不变)
function playPreviousEpisode() { if (currentEpisodeIndex > 0) { /* ... */ } }
// 播放下一集 (不变)
function playNextEpisode() { if (currentEpisodeIndex < currentEpisodes.length - 1) { /* ... */ } }
// 处理播放器错误 (不变)
function handlePlayerError() { /* ... */ }
// 渲染剧集按钮 (不变)
function renderEpisodes(vodName) { /* ... (不变) ... */ }
// 切换排序 (不变)
function toggleEpisodeOrder() { /* ... (不变) ... */ }


// --- 豆瓣推荐函数 ---
async function fetchDoubanTV() {
    if (isFetchingDouban) { console.log("Fetching Douban data..."); return; }
    isFetchingDouban = true;

    const container = document.getElementById("douban-results");
    const loadingIndicator = document.getElementById("loading"); // 指向容器内的 loading
    const nextBtn = document.getElementById("nextBatchBtn");

    // 显示加载状态
    if (container && currentDoubanPage === 0) { // 仅在第一页或切换分类时显示整体加载
        container.innerHTML = '<div class="col-span-full text-center text-gray-400 py-8">正在加载推荐...</div>';
    }
    if (nextBtn) nextBtn.disabled = true;


    const proxy = "https://api.allorigins.win/raw?url="; // 豆瓣需要代理
    const pageStart = currentDoubanPage * doubanPageLimit;
    const target = `https://movie.douban.com/j/search_subjects?type=tv&tag=${currentDoubanTag}&sort=recommend&page_limit=${doubanPageLimit}&page_start=${pageStart}`;

    console.log(`Fetching Douban: ${decodeURIComponent(currentDoubanTag)} - Page ${currentDoubanPage + 1}`);

    try {
        const response = await fetch(proxy + encodeURIComponent(target));
        if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
        const data = await response.json();

        if (container) {
            // 如果是第一页，先清空
             if (currentDoubanPage === 0) {
                 container.innerHTML = '';
             }

            if (data.subjects && data.subjects.length > 0) {
                const fragment = document.createDocumentFragment();
                data.subjects.forEach(tv => {
                    const item = document.createElement("div");
                    item.className = "bg-white/5 hover:bg-white/10 transition transform scale-95 rounded-lg overflow-hidden p-2 flex flex-col items-center text-center";
                    item.innerHTML = `
                      <button
                        class="relative w-full flex justify-center group active:scale-95 transition transform duration-150 ease-in-out"
                        onclick="fillAndSearch('${tv.title.replace(/'/g, "\\'")}')"
                      >
                      <div class="relative w-full aspect-[2/3] overflow-hidden rounded-md"> <!-- 使用 aspect-ratio -->
                      <img
                        src="${tv.cover}"
                        alt="${tv.title}"
                        class="w-full h-full object-contain rounded-md group-hover:opacity-90 transition duration-300 ease-in-out" <!-- 使用 object-contain -->
                      />
                        <div class="absolute bottom-2 left-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded">
                          评分: ${tv.rate || "暂无"}
                        </div>
                      </div>
                      </button>
                      <a
                        href="${tv.url}"
                        target="_blank"
                        class="mt-2 w-full block text-sm font-semibold truncate hover:text-blue-400"
                        title="${tv.title}"
                      >
                        ${tv.title}
                      </a>
                    `;
                    fragment.appendChild(item);
                });
                container.appendChild(fragment);

                if (data.subjects.length < doubanPageLimit) { console.log("豆瓣可能没有更多数据了"); }

            } else {
                console.log("豆瓣当前页无数据");
                if (currentDoubanPage === 0) {
                   container.innerHTML = `<div class="col-span-full text-center text-gray-400 py-8">当前分类下暂无推荐内容</div>`;
                } else {
                    showToast("没有更多推荐内容了", "info");
                    currentDoubanPage = Math.max(0, currentDoubanPage - 1);
                }
            }
        } // end if(container)

    } catch (err) {
        console.error("豆瓣 API 请求失败：", err);
        if (container && currentDoubanPage === 0) {
           container.innerHTML = `<div class="col-span-full text-red-400 text-center">❌ 获取豆瓣推荐失败，请稍后重试。</div>`;
        } else {
           showToast("获取下一批推荐失败", "error");
           currentDoubanPage = Math.max(0, currentDoubanPage - 1);
        }
    } finally {
        isFetchingDouban = false;
        if (nextBtn) nextBtn.disabled = false;
         // 确保加载指示器（如果存在且独立）被隐藏
         const generalLoading = document.getElementById("loading");
         if (generalLoading && generalLoading.style.display !== 'none') {
            // hideLoading(); // 应该调用 hideLoading 而不是直接设置 display
         }

    }
}

// --- 填充并搜索函数 ---
function fillAndSearch(title) {
      const input = document.getElementById('searchInput');
      if (input) {
          input.value = title;
          search(); // 直接调用 search
      }
}
