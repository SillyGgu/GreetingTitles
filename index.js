import {
    saveSettingsDebounced,
    characters,
    this_chid
} from '../../../../script.js';

import {
    extension_settings
} from '../../../extensions.js';

const extensionName = 'GreetingTitles';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// 기본 설정
const DEFAULT_SETTINGS = {
    charData: {} 
};

// =================================================================================
// 0. 헬퍼 함수: 저장 키(Key) 가져오기
// =================================================================================

function getCurrentCharKey() {
    if (!this_chid || !characters[this_chid]) return null;
    // [변경점] ID 대신 캐릭터의 '이름'을 고유 키로 사용합니다.
    return characters[this_chid].name;
}

// =================================================================================
// 1. 입력창 주입 로직
// =================================================================================

function injectTitleInputs($context) {
    if (!this_chid) return;

    const $searchArea = $context ? $context : $('body');
    const $greetings = $searchArea.find('.alternate_greeting[data-index]').not('.greeting-title-input-injected');

    if ($greetings.length === 0) return;

    // 현재 캐릭터의 이름(Key)을 가져옵니다.
    const charKey = getCurrentCharKey();
    if (!charKey) return;

    $greetings.each(function() {
        const $el = $(this);
        const index = $el.attr('data-index'); 
        
        if ($el.find('.greeting-title-input').length > 0) return;

        const settings = extension_settings[extensionName];
        let savedTitle = "";
        
        // 이름으로 저장된 데이터를 우선 찾고, 없으면 혹시 모를 ID 데이터도 체크(호환성)
        if (settings && settings.charData) {
            if (settings.charData[charKey] && settings.charData[charKey][index]) {
                savedTitle = settings.charData[charKey][index];
            }
        }

        const $input = $('<input>', {
            type: 'text',
            class: 'greeting-title-input',
            placeholder: '제목/메모',
            'data-char-key': charKey, // [변경점] ID 대신 이름을 저장
            'data-index': index
        });

        $input.val(savedTitle);
        $input.on('click keydown keyup', (e) => e.stopPropagation());

        const $targetContainer = $el.find('summary .title_restorable .flex-container.alignItemsCenter');
        
        if ($targetContainer.length > 0) {
            $targetContainer.append($input);
            $el.addClass('greeting-title-input-injected');
        }
    });
}

// =================================================================================
// 2. 데이터 저장 로직
// =================================================================================

$(document).on('input', '.greeting-title-input', function() {
    const $this = $(this);
    // [변경점] 태그에 저장해둔 이름(Key)을 가져옵니다.
    const charKey = $this.attr('data-char-key');
    const index = $this.attr('data-index');
    const value = $this.val();

    if (!charKey || index === undefined) return;

    let settings = extension_settings[extensionName];
    if (!settings) {
        settings = DEFAULT_SETTINGS;
        extension_settings[extensionName] = settings;
    }
    if (!settings.charData) settings.charData = {};
    if (!settings.charData[charKey]) settings.charData[charKey] = {};

    if (value && value.trim() !== '') {
        settings.charData[charKey][index] = value;
    } else {
        delete settings.charData[charKey][index];
        // 데이터가 비었으면 키 자체를 삭제
        if (Object.keys(settings.charData[charKey]).length === 0) {
            delete settings.charData[charKey];
        }
    }
    saveSettingsDebounced();
});

// =================================================================================
// 3. 순서 변경(Move Up/Down) 동기화 로직
// =================================================================================

function swapGreetingTitles(indexA, indexB) {
    const charKey = getCurrentCharKey();
    if (!charKey) return;

    const settings = extension_settings[extensionName];
    if (!settings || !settings.charData || !settings.charData[charKey]) return;

    const data = settings.charData[charKey];
    const valA = data[indexA];
    const valB = data[indexB];

    if (valB !== undefined) data[indexA] = valB;
    else delete data[indexA];

    if (valA !== undefined) data[indexB] = valA;
    else delete data[indexB];

    saveSettingsDebounced();
}

function handleMoveAndRefresh(currentIndex, targetIndex) {
    swapGreetingTitles(currentIndex, targetIndex);
    $('.greeting-title-input').remove(); 
    $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
}

$(document).on('mousedown', '.move_up_alternate_greeting', function() {
    const $greeting = $(this).closest('.alternate_greeting');
    const index = parseInt($greeting.attr('data-index'));
    if (isNaN(index) || index <= 0) return;
    handleMoveAndRefresh(index, index - 1);
});

$(document).on('mousedown', '.move_down_alternate_greeting', function() {
    const $greeting = $(this).closest('.alternate_greeting');
    const index = parseInt($greeting.attr('data-index'));
    const total = $greeting.parent().children('.alternate_greeting').length;
    if (isNaN(index) || index >= total - 1) return;
    handleMoveAndRefresh(index, index + 1);
});

$(document).on('mousedown', '.delete_alternate_greeting', function() {
    const $greeting = $(this).closest('.alternate_greeting');
    const deletedIndex = parseInt($greeting.attr('data-index'));
    const charKey = getCurrentCharKey();
    
    if (!charKey || isNaN(deletedIndex)) return;

    const settings = extension_settings[extensionName];
    if (!settings || !settings.charData || !settings.charData[charKey]) return;

    const data = settings.charData[charKey];
    const newData = {};

    Object.keys(data).forEach(key => {
        const idx = parseInt(key);
        if (idx < deletedIndex) {
            newData[idx] = data[idx];
        } else if (idx > deletedIndex) {
            newData[idx - 1] = data[idx];
        }
    });

    settings.charData[charKey] = newData;
    saveSettingsDebounced();

    $('.greeting-title-input').remove();
    $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
});

// =================================================================================
// 4. 화면 감지
// =================================================================================

const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.type === 'attributes') {
            const $target = $(mutation.target);
            if ($target.hasClass('alternate_greetings_list') || 
                $target.find('.alternate_greeting').length > 0 ||
                $target.hasClass('popup-content') ||
                $target.closest('.alternate_greetings_list').length > 0) {
                shouldCheck = true;
                break;
            }
        }
    }
    
    if (shouldCheck) {
        setTimeout(() => {
            injectTitleInputs($('body'));
        }, 50);
    }
});

// =================================================================================
// 5. 설정창 UI 관리 (데이터 이동 포함)
// =================================================================================

function renderSettingsList() {
    const $container = $('#greeting_titles_list_container');
    if ($container.length === 0) return;

    $container.empty();
    const settings = extension_settings[extensionName];
    
    if (!settings || !settings.charData || Object.keys(settings.charData).length === 0) {
        $container.append('<div style="padding:10px; text-align:center; color:#777;">저장된 데이터가 없습니다.</div>');
        return;
    }

    // [변경점] charIdOrName: 이제 ID가 아니라 이름일 수도 있고, 옛날 ID일 수도 있습니다.
    Object.entries(settings.charData).forEach(([charIdOrName, titles]) => {
        // 화면 표시용 이름 결정 로직
        let displayName = charIdOrName;
        let isOldId = false;

        // 만약 키가 현재 로드된 캐릭터 목록의 ID와 일치한다면 -> 옛날 방식으로 저장된 데이터임
        if (characters[charIdOrName]) {
            displayName = `${characters[charIdOrName].name} (ID: ${charIdOrName})`;
            isOldId = true;
        } 
        
        let titlesHtml = '';
        const sortedIndexes = Object.keys(titles).sort((a, b) => parseInt(a) - parseInt(b));
        
        sortedIndexes.forEach((idx) => {
            const txt = titles[idx];
            titlesHtml += `
                <div style="display:flex; justify-content:space-between; margin-top:4px; padding:4px; background:#eee; border-radius:4px; font-size:0.85rem;">
                    <span>#${parseInt(idx) + 1}: <b>${txt}</b></span>
                </div>`;
        });

        const html = `
            <div class="title-list-item">
                <div class="title-header">
                    <strong style="font-size: 1.1em; color: #444;">${displayName}</strong>
                    <div style="display:flex; gap:5px;">
                        <button class="migrate-btn" data-key="${charIdOrName}" title="이 데이터를 현재 캐릭터 이름으로 가져옵니다">
                            <i class="fa-solid fa-file-import" style="margin-right:4px;"></i>이동
                        </button>
                        <button class="delete-btn red_button" data-key="${charIdOrName}" title="삭제">
                            <i class="fa-solid fa-trash" style="margin-right:4px;"></i>삭제
                        </button>
                    </div>
                </div>
                <div>${titlesHtml}</div>
            </div>
        `;
        $container.append(html);
    });

    // [이벤트] 데이터 이동 (Migrate)
    $('.migrate-btn').off('click').on('click', function() {
        const oldKey = $(this).data('key'); // 복사할 원본 키 (ID 또는 다른 이름)
        const currentName = getCurrentCharKey(); // 현재 캐릭터의 이름 (타겟)
        
        if (!currentName) {
            toastr.warning('데이터를 이동할 대상(현재 캐릭터)이 선택되지 않았습니다.');
            return;
        }

        if (oldKey === currentName) {
            toastr.info('이미 현재 선택된 캐릭터(이름 기준)의 데이터입니다.');
            return;
        }

        const msg = `선택한 데이터를 현재 캐릭터 이름('${currentName}')으로 이동하시겠습니까?\n\n기존 ID방식 데이터라면 이름 방식 데이터로 변환됩니다.`;

        if (confirm(msg)) {
            const settings = extension_settings[extensionName];
            if (settings.charData[oldKey]) {
                // 데이터 복사 (이름 키로 저장)
                settings.charData[currentName] = JSON.parse(JSON.stringify(settings.charData[oldKey]));
                
                // 원본 삭제
                delete settings.charData[oldKey];
                
                saveSettingsDebounced();
                renderSettingsList();
                
                // 입력창 갱신
                $('.greeting-title-input').remove(); 
                $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
                injectTitleInputs($('body'));

                toastr.success(`데이터가 '${currentName}'(으)로 이동되었습니다.`);
            }
        }
    });

    // [이벤트] 삭제
    $('.delete-btn').off('click').on('click', function() {
        const key = $(this).data('key');
        if (confirm('이 데이터(메모)를 영구적으로 삭제하시겠습니까?')) {
            if (extension_settings[extensionName].charData[key]) {
                delete extension_settings[extensionName].charData[key];
                saveSettingsDebounced();
                renderSettingsList();
                
                // 만약 현재 보고 있는 캐릭터의 데이터였다면 입력창도 비움
                const currentName = getCurrentCharKey();
                if (key === currentName) {
                     $(`.greeting-title-input`).val('');
                }
            }
        }
    });
}

// =================================================================================
// 6. 초기화
// =================================================================================

(async function() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = DEFAULT_SETTINGS;
    }

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings").append(settingsHtml);
        
        $('#refresh_titles_list_btn').on('click', renderSettingsList);
        
        renderSettingsList();

        $(document).on('click', '.greetingtitles-settings .inline-drawer-header', renderSettingsList);
        $(document).on('click', '.greetingtitles-settings .inline-drawer-toggle', renderSettingsList);

    } catch (e) {
        console.error(`[${extensionName}] Settings HTML load failed:`, e);
    }

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
})();