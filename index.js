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
    if (this_chid === undefined || this_chid === null || this_chid === -1) return null;
    const char = characters[this_chid];
    if (!char) return null;
    
    // [개편] 아바타 파일명을 고유 ID로 사용 (없으면 이름 사용)
    // Popupmemo의 getCharacterKey 로직과 동일하게 변경하여 안정성을 높입니다.
    return char.avatar || char.name;
}

// =================================================================================
// 1. 입력창 주입 로직
// =================================================================================

function injectTitleInputs($context) {
    if (!this_chid) return;

    const $searchArea = $context ? $context : $('body');
    const $greetings = $searchArea.find('.alternate_greeting[data-index]').not('.greeting-title-input-injected');

    if ($greetings.length === 0) return;

    // 현재 캐릭터의 고유 키(Avatar 파일명)를 가져옵니다.
    const charKey = getCurrentCharKey();
    if (!charKey) return;

    $greetings.each(function() {
        const $el = $(this);
        const index = $el.attr('data-index'); 
        
        if ($el.find('.greeting-title-input').length > 0) return;

        const settings = extension_settings[extensionName];
        let savedTitle = "";
        
        // 데이터 구조 보장 및 로드
        if (settings && settings.charData && settings.charData[charKey]) {
            if (settings.charData[charKey][index]) {
                savedTitle = settings.charData[charKey][index];
            }
        }

		const $input = $('<input>', {
            type: 'text',
            class: 'greeting-title-input',
            placeholder: '제목/메모',
            'data-char-key': charKey, 
            'data-index': index
        });

        $input.val(savedTitle);

        $input.on('click mousedown keydown keyup keypress', (e) => {
            e.stopPropagation(); 
        });

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
    const charKey = $this.attr('data-char-key');
    const index = $this.attr('data-index');
    const value = $this.val();

    if (!charKey || index === undefined) return;

    let settings = extension_settings[extensionName];
    if (!settings) {
        settings = DEFAULT_SETTINGS;
        extension_settings[extensionName] = settings;
    }
    
    // Popupmemo 스타일의 안전한 데이터 구조 생성
    if (!settings.charData) settings.charData = {};
    if (!settings.charData[charKey]) settings.charData[charKey] = {};

    if (value && value.trim() !== '') {
        settings.charData[charKey][index] = value;
    } else {
        delete settings.charData[charKey][index];
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

    // [개편] 저장된 각 항목을 돌면서 실제 캐릭터 정보를 찾습니다.
    Object.entries(settings.charData).forEach(([charKey, titles]) => {
        // Popupmemo 스타일의 이름 결정 로직
        const charCard = characters.find(c => c.avatar === charKey || c.name === charKey);
        const displayName = charCard ? charCard.name : `(미설치/삭제됨: ${charKey})`;
        
        let titlesHtml = '';
        const sortedIndexes = Object.keys(titles).sort((a, b) => parseInt(a) - parseInt(b));
        
        sortedIndexes.forEach((idx) => {
            const txt = titles[idx];
            titlesHtml += `
                <div style="display:flex; justify-content:space-between; margin-top:4px; padding:4px; background:rgba(0,0,0,0.05); border-radius:4px; font-size:0.85rem;">
                    <span>#${parseInt(idx) + 1}: <b>${txt}</b></span>
                </div>`;
        });

        const html = `
            <div class="title-list-item" style="border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px;">
                <div class="title-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong style="font-size: 1.1em; color: var(--mainColor);">${displayName}</strong>
                    <div style="display:flex; gap:5px;">
                        <button class="migrate-btn" data-key="${charKey}" title="이 데이터를 현재 캐릭터로 가져오기">
                            <i class="fa-solid fa-file-import"></i> 이동
                        </button>
                        <button class="delete-btn red_button" data-key="${charKey}" title="삭제">
                            <i class="fa-solid fa-trash"></i>
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
        const oldKey = $(this).data('key'); 
        const currentKey = getCurrentCharKey(); 
        
        if (!currentKey) {
            toastr.warning('데이터를 이동할 대상(현재 캐릭터)이 선택되지 않았습니다.');
            return;
        }

        if (oldKey === currentKey) {
            toastr.info('이미 현재 선택된 캐릭터의 데이터입니다.');
            return;
        }

        const msg = `선택한 데이터를 현재 활성화된 캐릭터로 이동하시겠습니까?\n\n주의: 기존 데이터는 삭제되고 현재 캐릭터의 데이터로 덮어씌워집니다.`;

        if (confirm(msg)) {
            const settings = extension_settings[extensionName];
            if (settings.charData[oldKey]) {
                // 데이터 복사
                settings.charData[currentKey] = JSON.parse(JSON.stringify(settings.charData[oldKey]));
                // 원본 삭제
                delete settings.charData[oldKey];
                
                saveSettingsDebounced();
                renderSettingsList();
                
                // 입력창 갱신
                $('.greeting-title-input').remove(); 
                $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
                injectTitleInputs($('body'));

                toastr.success(`데이터가 이동되었습니다.`);
            }
        }
    });

    // [이벤트] 삭제
    $('.delete-btn').off('click').on('click', function() {
        const key = $(this).data('key');
        if (confirm('이 캐릭터의 모든 메모를 삭제하시겠습니까?')) {
            if (extension_settings[extensionName].charData[key]) {
                delete extension_settings[extensionName].charData[key];
                saveSettingsDebounced();
                renderSettingsList();
                
                const currentKey = getCurrentCharKey();
                if (key === currentKey) {
                     $(`.greeting-title-input`).val('');
                }
            }
        }
    });
}

// =================================================================================
// 6. 메인 채팅창 스와이프 시 제목 표시 로직
// =================================================================================

$(document).on('click', '.swipe_left, .swipe_right', function() {
    const $mes = $(this).closest('.mes');
    const $idDisplay = $mes.find('.mesIDDisplay');
    
    if ($idDisplay.length === 0 || $idDisplay.text().trim() !== '#0') return;

    const $counter = $mes.find('.swipes-counter');
    if ($counter.length === 0) return;

    const observer = new MutationObserver((mutations) => {
        const counterText = $counter.text().trim();
        if (!counterText) return;

        const parts = counterText.split('/');
        if (parts.length < 2) return;

        const currentIndex = parseInt(parts[0].trim()) - 1;
        if (isNaN(currentIndex) || currentIndex < 0) return;

        // [개편] 새로운 고유 키 방식 적용
        const charKey = getCurrentCharKey();
        if (!charKey) return;

        const settings = extension_settings[extensionName];
        
        observer.disconnect();

        if (settings && settings.charData && settings.charData[charKey]) {
            const savedTitle = settings.charData[charKey][currentIndex];

            if (savedTitle) {
                toastr.info(savedTitle, '', {
                    timeOut: 3000,
                    extendedTimeOut: 1000,
                    hideDuration: 1500,
                    showDuration: 300,
                    showMethod: 'fadeIn',
                    hideMethod: 'fadeOut',
                    preventDuplicates: true,
                    positionClass: 'toast-top-center',
                    closeButton: false
                });
            }
        }
    });

    observer.observe($counter[0], { childList: true, characterData: true, subtree: true });
    setTimeout(() => observer.disconnect(), 1000);
});

// =================================================================================
// 7. 초기화
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