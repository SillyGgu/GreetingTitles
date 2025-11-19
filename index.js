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
// 1. 입력창 주입 로직
// =================================================================================

function injectTitleInputs($context) {
    if (!this_chid) return;

    const $searchArea = $context ? $context : $('body');
    const $greetings = $searchArea.find('.alternate_greeting[data-index]').not('.greeting-title-input-injected');

    if ($greetings.length === 0) return;

    $greetings.each(function() {
        const $el = $(this);
        const index = $el.attr('data-index'); 
        
        if ($el.find('.greeting-title-input').length > 0) return;

        const settings = extension_settings[extensionName];
        let savedTitle = "";
        if (settings && settings.charData && settings.charData[this_chid]) {
            savedTitle = settings.charData[this_chid][index] || "";
        }

        const $input = $('<input>', {
            type: 'text',
            class: 'greeting-title-input',
            placeholder: '제목/메모',
            'data-char-id': this_chid,
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
    const charId = $this.attr('data-char-id') || this_chid;
    const index = $this.attr('data-index');
    const value = $this.val();

    if (!charId || index === undefined) return;

    let settings = extension_settings[extensionName];
    if (!settings) {
        settings = DEFAULT_SETTINGS;
        extension_settings[extensionName] = settings;
    }
    if (!settings.charData) settings.charData = {};
    if (!settings.charData[charId]) settings.charData[charId] = {};

    if (value && value.trim() !== '') {
        settings.charData[charId][index] = value;
    } else {
        delete settings.charData[charId][index];
        if (Object.keys(settings.charData[charId]).length === 0) {
            delete settings.charData[charId];
        }
    }
    saveSettingsDebounced();
});

// =================================================================================
// 3. [유지됨] 순서 변경(Move Up/Down) 동기화 로직
// =================================================================================

function swapGreetingTitles(indexA, indexB) {
    if (!this_chid) return;
    const settings = extension_settings[extensionName];
    if (!settings || !settings.charData || !settings.charData[this_chid]) return;

    const data = settings.charData[this_chid];
    const valA = data[indexA];
    const valB = data[indexB];

    if (valB !== undefined) data[indexA] = valB;
    else delete data[indexA];

    if (valA !== undefined) data[indexB] = valA;
    else delete data[indexB];

    saveSettingsDebounced();
}

// 데이터를 바꾸고 화면을 강제로 리프레시(입력창 제거 -> 재주입 유도)
function handleMoveAndRefresh(currentIndex, targetIndex) {
    swapGreetingTitles(currentIndex, targetIndex);
    $('.greeting-title-input').remove(); 
    $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
}

// Move Up 감지
$(document).on('mousedown', '.move_up_alternate_greeting', function() {
    const $greeting = $(this).closest('.alternate_greeting');
    const index = parseInt($greeting.attr('data-index'));
    
    if (isNaN(index) || index <= 0) return;
    handleMoveAndRefresh(index, index - 1);
});

// Move Down 감지
$(document).on('mousedown', '.move_down_alternate_greeting', function() {
    const $greeting = $(this).closest('.alternate_greeting');
    const index = parseInt($greeting.attr('data-index'));
    const total = $greeting.parent().children('.alternate_greeting').length;

    if (isNaN(index) || index >= total - 1) return;
    handleMoveAndRefresh(index, index + 1);
});

// 삭제 감지
$(document).on('mousedown', '.delete_alternate_greeting', function() {
    const $greeting = $(this).closest('.alternate_greeting');
    const deletedIndex = parseInt($greeting.attr('data-index'));
    
    if (!this_chid || isNaN(deletedIndex)) return;

    const settings = extension_settings[extensionName];
    if (!settings || !settings.charData || !settings.charData[this_chid]) return;

    const data = settings.charData[this_chid];
    const newData = {};

    Object.keys(data).forEach(key => {
        const idx = parseInt(key);
        if (idx < deletedIndex) {
            newData[idx] = data[idx];
        } else if (idx > deletedIndex) {
            newData[idx - 1] = data[idx];
        }
    });

    settings.charData[this_chid] = newData;
    saveSettingsDebounced();

    $('.greeting-title-input').remove();
    $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
});


// =================================================================================
// 4. 화면 감지 (MutationObserver)
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
            const $body = $('body');
            injectTitleInputs($body);
            // injectGlobalControlButtons 제거됨
        }, 50);
    }
});

// =================================================================================
// 5. 설정창 UI 관리
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

    Object.entries(settings.charData).forEach(([charId, titles]) => {
        const charName = characters[charId] ? characters[charId].name : `Unknown ID (${charId.substring(0,5)}...)`;
        
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
                    <strong>${charName}</strong>
                    <button class="delete-btn red_button" data-id="${charId}">전체 삭제</button>
                </div>
                <div>${titlesHtml}</div>
            </div>
        `;
        $container.append(html);
    });

    $('.delete-btn').off('click').on('click', function() {
        const id = $(this).data('id');
        if (confirm('이 캐릭터의 메모를 모두 삭제하시겠습니까?')) {
            if (extension_settings[extensionName].charData[id]) {
                delete extension_settings[extensionName].charData[id];
                saveSettingsDebounced();
                renderSettingsList();
                $(`.greeting-title-input[data-char-id="${id}"]`).val('');
            }
        }
    });
}

// =================================================================================
// 6. 초기화 실행
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