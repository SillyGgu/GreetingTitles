import {
    saveSettingsDebounced,
    characters,
    this_chid,
    eventSource,
    event_types
} from '../../../../script.js';

import {
    extension_settings
} from '../../../extensions.js';

const extensionName = 'GreetingTitles';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const DEFAULT_SETTINGS = {
    charData: {},
    popupState: { 
        top: 100,
        left: 100,
        width: 400,
        height: 500
    }
};

// =================================================================================
// 0. 스타일 주입 (스크롤 문제 해결됨: calc 사용)
// =================================================================================
function injectPopupStyles() {
    const styleId = 'greeting-titles-popup-style';
    if ($(`#${styleId}`).length > 0) return;

    const headerHeight = '50px'; 

    const css = `
        #greeting-titles-custom-popup {
            position: fixed;
            top: 20%;
            left: 20%;
            width: 400px;
            height: 500px;
            min-width: 300px;
            min-height: 200px;
            background-color: var(--SmartThemebg, #ffffff);
            border: 1px solid var(--SmartThemeBorderColor, #ccc);
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 9999;
            display: none;
            overflow: hidden; 
            font-family: inherit;
        }
        .gt-popup-header {
            height: ${headerHeight};
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 16px;
            background-color: var(--SmartThemeDetailsBackgroundColor, #eee);
            border-bottom: 1px solid var(--SmartThemeBorderColor, #ccc);
            cursor: move;
            user-select: none;
            box-sizing: border-box;
        }
        .gt-popup-title {
            font-weight: 700;
            font-size: 1.1em;
            color: var(--SmartThemeBodyColor, #333);
        }
        .gt-popup-close {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.2em;
            color: var(--SmartThemeBodyColor, #333);
            opacity: 0.7;
        }
        .gt-popup-close:hover { opacity: 1; }
        
        .gt-popup-content {
            height: calc(100% - ${headerHeight});
            overflow-y: auto;
            padding: 0;
            box-sizing: border-box;
        }
        .gt-list-item {
            padding: 12px 16px;
            border-bottom: 1px solid var(--SmartThemeBorderColor, #eee);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: background 0.2s;
        }
        .gt-list-item:hover {
            background-color: rgba(127, 127, 127, 0.1);
        }
        .gt-item-idx {
            background: var(--SmartThemeQuoteColor, #57b894);
            color: #fff;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.85em;
            font-weight: bold;
            flex-shrink: 0;
        }
        .gt-item-text {
            flex-grow: 1;
            font-size: 0.95em;
            color: var(--SmartThemeBodyColor, #333);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .gt-item-arrow {
            opacity: 0.3;
        }
        .gt-resize-handle {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: nwse-resize;
            background: linear-gradient(135deg, transparent 50%, var(--SmartThemeBorderColor, #ccc) 50%);
            opacity: 0.6;
            z-index: 10;
        }
        .gt-resize-handle:hover {
            opacity: 1;
            background: linear-gradient(135deg, transparent 50%, var(--SmartThemeQuoteColor, #57b894) 50%);
        }

        body.gt-hide-typing-indicator #stc_typing_indicator {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }
    `;
    $('<style>').attr('id', styleId).text(css).appendTo('head');
}

// =================================================================================
// 1. 헬퍼 함수
// =================================================================================

function getCurrentCharKey() {
    if (this_chid === undefined || this_chid === null || this_chid === -1) return null;
    const char = characters[this_chid];
    if (!char) return null;
    return char.avatar || char.name;
}
function downloadAsJson(exportObj, exportName) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}
// =================================================================================
// 2. Custom Popup 생성 및 관리
// =================================================================================

function createCustomPopup() {
    if ($('#greeting-titles-custom-popup').length > 0) return;

    const popupHtml = `
        <div id="greeting-titles-custom-popup">
            <div class="gt-popup-header">
                <span class="gt-popup-title"><i class="fa-solid fa-book-open"></i> 저장된 그리팅 목록</span>
                <div style="display:flex; align-items:center; gap:6px;">
                    <button class="gt-popup-edit" title="이 그리팅 제목 편집 (alt 그리팅 창에서 수정)"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="gt-popup-close"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>
            <div class="gt-popup-content" id="gt-popup-list-area">
                <!-- 리스트가 여기에 들어갑니다 -->
            </div>
            <!-- 리사이징 핸들 -->
            <div class="gt-resize-handle"></div>
        </div>
    `;

    $('body').append(popupHtml);
    const $popup = $('#greeting-titles-custom-popup');

    const settings = extension_settings[extensionName];
    if (!settings.popupState) {
        settings.popupState = DEFAULT_SETTINGS.popupState;
    }

    // 초기 위치 설정 (모바일/PC 구분)
    if ($(window).width() <= 768) {
        const $chat = $('#chat');
        if ($chat.length > 0) {
            const rect = $chat[0].getBoundingClientRect();
            $popup.css({
                'position': 'fixed',
                'top': (rect.top + 20) + 'px',
                'left': (rect.left + (rect.width * 0.05)) + 'px',
                'width': (rect.width * 0.9) + 'px',
                'height': (rect.height * 0.7) + 'px',
                'transform': 'none',
                'margin': '0'
            });
        }
    } else {
        const pos = settings.popupState;
        $popup.css({
            'top': (pos.top || 100) + 'px',
            'left': (pos.left || 100) + 'px',
            'width': (pos.width || 400) + 'px',
            'height': (pos.height || 500) + 'px',
            'transform': 'none'
        });
    }

    $('.gt-popup-close').on('click', function() {
        $popup.fadeOut(200);
    });

    $(document).off('click.gt-edit').on('click.gt-edit', '.gt-popup-edit', function() {
        const $popup = $('#greeting-titles-custom-popup');
        const isEditMode = $popup.data('edit-mode') || false;

        if (!isEditMode) {
            // ── 편집 모드 진입 ──
            $popup.data('edit-mode', true);
            $(this).html('<i class="fa-solid fa-check"></i>').attr('title', '완료 (저장)').css({ color: '#57b894', opacity: '1' });
            renderPopupList(true);

        } else {
            // ── 편집 모드 완료 → 저장 ──
            const charKey = getCurrentCharKey();
            if (!charKey) return;

            const settings = extension_settings[extensionName];
            if (!settings.charData) settings.charData = {};
            if (!settings.charData[charKey]) settings.charData[charKey] = {};

            // 모든 input값 수집해서 저장
            $('#gt-popup-list-area .gt-title-edit-input').each(function() {
                const idx = $(this).data('index');
                const val = $(this).val().trim();
                if (val !== '') {
                    settings.charData[charKey][idx] = val;
                } else {
                    delete settings.charData[charKey][idx];
                }
            });

            // charData 정리 (빈 캐릭터 데이터 제거)
            if (Object.keys(settings.charData[charKey]).length === 0) {
                delete settings.charData[charKey];
            }

            saveSettingsDebounced();

            // alt greeting 창이 열려있으면 title input도 동기화
            const updatedData = settings.charData && settings.charData[charKey] ? settings.charData[charKey] : {};
            $(`.alternate_greeting[data-index]`).each(function() {
                const idx = $(this).attr('data-index');
                const $input = $(this).find('.greeting-title-input');
                if ($input.length) {
                    $input.val(updatedData[idx] || '');
                }
            });

            $popup.data('edit-mode', false);
            $(this).html('<i class="fa-solid fa-pen-to-square"></i>').attr('title', '타이틀 편집 모드').css({ color: '', opacity: '' });
            renderPopupList(false);

            // 설정창 목록도 갱신
            renderSettingsList();

            toastr.success('타이틀이 저장되었습니다!', '', { timeOut: 1500, positionClass: 'toast-top-center' });
        }
    });

    const $header = $popup.find('.gt-popup-header');
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    $header.on('mousedown', function(e) {
        if ($(e.target).closest('.gt-popup-close').length) return;
        
        if ($(window).width() <= 768) return; 

        e.preventDefault(); 
        isDragging = true;
        dragOffset.x = e.clientX - $popup.offset().left;
        dragOffset.y = e.clientY - $popup.offset().top;
        $header.css('cursor', 'grabbing');
        $('body').css('user-select', 'none'); 
    });

    $(document).on('mousemove', function(e) {
        if (isDragging) {
            e.preventDefault();
            $popup.offset({
                top: e.clientY - dragOffset.y,
                left: e.clientX - dragOffset.x
            });
        }
    });

    $(document).on('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            $header.css('cursor', 'move');
            $('body').css('user-select', '');

            if ($(window).width() > 768) {
                const curPos = $popup.position();
                settings.popupState.top = curPos.top;
                settings.popupState.left = curPos.left;
                saveSettingsDebounced();
            }
        }
    });

    const $resizeHandle = $popup.find('.gt-resize-handle');
    let isResizing = false;

    $resizeHandle.on('mousedown', function(e) {
        e.preventDefault(); 
        e.stopPropagation(); 
        isResizing = true;
        $('body').css('user-select', 'none'); 
    });

    $(document).on('mousemove', function(e) {
        if (isResizing) {
            e.preventDefault();
            const newWidth = e.clientX - $popup.offset().left;
            const newHeight = e.clientY - $popup.offset().top;

            if (newWidth > 300) $popup.css('width', newWidth + 'px');
            if (newHeight > 200) $popup.css('height', newHeight + 'px');
        }
    });

    $(document).on('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            $('body').css('user-select', '');

            if ($(window).width() > 768) {
                settings.popupState.width = $popup.width();
                settings.popupState.height = $popup.height();
                saveSettingsDebounced();
            }
        }
    });
}

function renderPopupList(isEditMode) {
    const charKey = getCurrentCharKey();
    if (!charKey) return;

    const settings = extension_settings[extensionName];
    const storedData = (settings && settings.charData && settings.charData[charKey]) ? settings.charData[charKey] : {};
    const char = characters[this_chid];
    const altGreetings = char.data && char.data.alternate_greetings ? char.data.alternate_greetings : [];

    const $listArea = $('#gt-popup-list-area');
    $listArea.empty();

    // 편집 모드 안내 배너
    if (isEditMode) {
        $listArea.append(`
            <div style="padding: 8px 16px; background: rgba(87,184,148,0.1); border-bottom: 1px solid rgba(87,184,148,0.2); font-size: 0.8rem; color: #57b894;">
                <i class="fa-solid fa-pen-to-square"></i> 편집 모드 — 제목을 수정하고 ✓ 완료를 누르세요.
            </div>
        `);
    }

    altGreetings.forEach((content, idx) => {
        const savedTitle = storedData[idx] && storedData[idx].trim() !== '' ? storedData[idx] : '';

        if (isEditMode) {
            // ── 편집 모드 아이템 ──
            const $item = $(`
                <div class="gt-list-item gt-edit-mode-item" data-index="${idx}" style="cursor: default; flex-wrap: nowrap; align-items: center; gap: 10px;">
                    <div class="gt-item-idx">${idx + 1}</div>
                    <input
                        type="text"
                        class="gt-title-edit-input"
                        data-index="${idx}"
                        placeholder="${content.substring(0, 40).replace(/"/g, '&quot;')}..."
                        value="${savedTitle.replace(/"/g, '&quot;')}"
                        style="flex-grow:1; min-width:0; padding: 5px 10px; border-radius: 8px;
                               border: 1px solid rgba(87,184,148,0.4); background: rgba(87,184,148,0.05);
                               color: var(--SmartThemeBodyColor); font-size: 0.9em; outline: none;
                               transition: border-color 0.2s, box-shadow 0.2s;"
                    />
                    <button class="gt-copy-btn" data-index="${idx}" title="그리팅 텍스트 복사"
                        style="background: none; border: none; cursor: pointer; opacity: 0.5;
                               font-size: 0.9em; padding: 4px 7px; border-radius: 6px;
                               color: var(--SmartThemeBodyColor); transition: all 0.2s; flex-shrink: 0;">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                </div>
            `);

            // input 포커스 스타일
            $item.find('.gt-title-edit-input')
                .on('focus', function() {
                    $(this).css({ 'border-color': '#57b894', 'box-shadow': '0 0 0 3px rgba(87,184,148,0.15)' });
                })
                .on('blur', function() {
                    $(this).css({ 'border-color': 'rgba(87,184,148,0.4)', 'box-shadow': 'none' });
                })
                .on('click mousedown keydown keyup keypress', function(e) {
                    e.stopPropagation();
                });

            // 복사 버튼
            $item.find('.gt-copy-btn').on('click', function(e) {
                e.stopPropagation();
                gtCopyGreeting(content, $(this));
            }).on('mouseenter', function() {
                $(this).css({ opacity: '1', background: 'rgba(87,184,148,0.12)' });
            }).on('mouseleave', function() {
                $(this).css({ opacity: '0.5', background: 'none' });
            });

            $listArea.append($item);

        } else {
            // ── 일반 모드 아이템 ──
            const hasTitle = savedTitle !== '';
            const displayTitle = hasTitle
                ? `<b>${savedTitle}</b>`
                : `<span style="opacity:0.8">${content.substring(0, 60)}...</span>`;

            const $item = $(`
                <div class="gt-list-item" data-index="${idx}">
                    <div class="gt-item-idx">${idx + 1}</div>
                    <div class="gt-item-text">${displayTitle}</div>
                    <button class="gt-copy-btn" data-index="${idx}" title="그리팅 텍스트 복사"
                        style="background: none; border: none; cursor: pointer; opacity: 0.5;
                               font-size: 0.9em; padding: 4px 7px; border-radius: 6px;
                               color: var(--SmartThemeBodyColor); transition: all 0.2s; flex-shrink: 0;">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <i class="fa-solid fa-chevron-right gt-item-arrow"></i>
                </div>
            `);

            // 그리팅 이동 클릭
            $item.on('click', function(e) {
                if ($(e.target).closest('.gt-copy-btn').length) return;
                const targetIdx = $(this).data('index');
                const hasMainGreeting = char.data && char.data.first_mes && char.data.first_mes.trim() !== '';
                const commandIdx = hasMainGreeting ? targetIdx + 1 : targetIdx;
                const title = storedData[targetIdx] && storedData[targetIdx].trim() !== '' ? storedData[targetIdx] : null;

                const $textarea = $('#send_textarea');
                const $sendBtn = $('#send_but');

                if ($textarea.length && $sendBtn.length) {
                    const hideStyleId = 'stc-force-hide-indicator';
                    if ($(`#${hideStyleId}`).length === 0) {
                        $('<style>')
                            .attr('id', hideStyleId)
                            .text('#stc_typing_indicator { display: none !important; opacity: 0 !important; visibility: hidden !important; }')
                            .appendTo('head');
                    }

                    if (title) {
                        toastr.info(title, '', {
                            timeOut: 2000,
                            preventDuplicates: true,
                            positionClass: 'toast-top-center',
                        });
                    }

                    const originalValue = $textarea.val();
                    $textarea.val(`/swipes-go ${commandIdx}`).trigger('input');
                    $sendBtn.trigger('click');

                    setTimeout(() => {
                        if ($textarea.val().startsWith('/swipes-go')) {
                            $textarea.val(originalValue).trigger('input');
                        }
                    }, 50);

                    setTimeout(() => {
                        if (eventSource && event_types) {
                            eventSource.emit(event_types.GENERATION_ENDED);
                        }
                    }, 100);

                    setTimeout(() => {
                        $('#stc_typing_indicator').remove();
                        $(`#${hideStyleId}`).remove();
                    }, 800);

                } else {
                    console.error('[GreetingTitles] 입력창을 찾을 수 없습니다.');
                }
            });

            // 복사 버튼
            $item.find('.gt-copy-btn').on('click', function(e) {
                e.stopPropagation();
                gtCopyGreeting(content, $(this));
            }).on('mouseenter', function() {
                $(this).css({ opacity: '1', background: 'rgba(87,184,148,0.12)' });
            }).on('mouseleave', function() {
                $(this).css({ opacity: '0.5', background: 'none' });
            });

            $listArea.append($item);
        }
    });
}

// 복사 공통 함수
function gtCopyGreeting(text, $btn) {
    navigator.clipboard.writeText(text).then(() => {
        const $icon = $btn.find('i');
        $icon.removeClass('fa-regular fa-copy').addClass('fa-solid fa-check');
        $btn.css({ opacity: '1', color: '#57b894' });
        setTimeout(() => {
            $icon.removeClass('fa-solid fa-check').addClass('fa-regular fa-copy');
            $btn.css({ opacity: '0.5', color: '' });
        }, 1500);
        toastr.success('그리팅 텍스트가 복사되었습니다!', '', { timeOut: 1500, positionClass: 'toast-top-center' });
    }).catch(() => {
        toastr.error('복사에 실패했습니다.', '', { timeOut: 1500 });
    });
}

function openGreetingSelectPopup() {
    createCustomPopup();

    const charKey = getCurrentCharKey();
    if (!charKey) {
        toastr.warning('캐릭터 정보를 불러올 수 없습니다.');
        return;
    }

    const char = characters[this_chid];
    const altGreetings = char.data && char.data.alternate_greetings ? char.data.alternate_greetings : [];

    if (altGreetings.length === 0) {
        toastr.info('이 캐릭터에는 추가 그리팅이 없습니다.');
        return;
    }

    const $popup = $('#greeting-titles-custom-popup');

    // 모바일 환경일 경우 열 때마다 chat 영역 기준으로 위치 재계산
    if ($(window).width() <= 768) {
        const $chat = $('#chat');
        if ($chat.length > 0) {
            const rect = $chat[0].getBoundingClientRect();
            const targetWidth = rect.width * 0.9;
            const targetHeight = Math.min(rect.height * 0.8, 500);
            const targetLeft = rect.left + (rect.width - targetWidth) / 2;
            const targetTop = rect.top + (rect.height * 0.1);

            $popup.css({
                'top': targetTop + 'px',
                'left': targetLeft + 'px',
                'width': targetWidth + 'px',
                'height': targetHeight + 'px'
            });
        }
    }

    // 팝업 열릴 때 항상 일반 모드로 시작
    $popup.data('edit-mode', false);
    const $editBtn = $popup.find('.gt-popup-edit');
    $editBtn.html('<i class="fa-solid fa-pen-to-square"></i>').attr('title', '타이틀 편집 모드');

    renderPopupList(false);
    $popup.fadeIn(200);
}

// =================================================================================
// 3. 입력창 주입 및 데이터 저장 로직
// =================================================================================

function injectTitleInputs($context) {
    if (!this_chid) return;

    const $searchArea = $context ? $context : $('body');
    const $greetings = $searchArea.find('.alternate_greeting[data-index]').not('.greeting-title-input-injected');

    if ($greetings.length === 0) return;

    const charKey = getCurrentCharKey();
    if (!charKey) return;

    $greetings.each(function() {
        const $el = $(this);
        const index = $el.attr('data-index'); 
        
        if ($el.find('.greeting-title-input').length > 0) return;

        const settings = extension_settings[extensionName];
        let savedTitle = "";
        
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
// 4. 순서 변경 동기화 로직
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
        if (idx < deletedIndex) newData[idx] = data[idx];
        else if (idx > deletedIndex) newData[idx - 1] = data[idx];
    });

    settings.charData[charKey] = newData;
    saveSettingsDebounced();
    $('.greeting-title-input').remove();
    $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
});

// =================================================================================
// 5. 버튼 주입 (UI Injection)
// =================================================================================

function injectGreetingListButton() {
    if (!this_chid && this_chid !== 0) return;
    const char = characters[this_chid];
    if (!char || !char.data) return;

    const altGreetings = char.data.alternate_greetings || [];
    if (altGreetings.length === 0) return;

    const $targetDiv = $('#first_message_div');
    if ($targetDiv.length === 0) return;
    if ($targetDiv.find('.open_greeting_titles_list').length > 0) return;

    const $altBtn = $targetDiv.find('.open_alternate_greetings');
    if ($altBtn.length === 0) return;

    const $myBtn = $('<div>', {
        class: 'menu_button menu_button_icon open_greeting_titles_list margin0 interactable',
        title: '저장된 그리팅 목록 열기',
        'data-i18n': '[title]Open Saved Greeting Titles',
        tabindex: '0',
        role: 'button',
        html: '<i class="fa-solid fa-book-open"></i>'
    });

    $myBtn.on('click', (e) => {
        e.stopPropagation();
        
        const $popup = $('#greeting-titles-custom-popup');
        if ($popup.is(':visible')) {
            $popup.fadeOut(200);
        } else {
            openGreetingSelectPopup();
        }
    });

    $altBtn.before($myBtn);
}

// =================================================================================
// 6. 화면 감지 (Observer)
// =================================================================================

let observerDebounceTimer = null;

const observer = new MutationObserver((mutations) => {
    let shouldCheckInputs = false;
    let shouldCheckButton = false;

    // 변경 사항 스캔
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.type === 'attributes') {
            const $target = $(mutation.target);
            
            // 조건 체크
            if ($target.hasClass('alternate_greetings_list') || 
                $target.find('.alternate_greeting').length > 0 ||
                $target.hasClass('popup-content') ||
                $target.closest('.alternate_greetings_list').length > 0) {
                shouldCheckInputs = true;
            }

            if ($target.attr('id') === 'first_message_div' || $target.find('#first_message_div').length > 0) {
                shouldCheckButton = true;
            }
        }
    }

    if (shouldCheckInputs || shouldCheckButton) {
        if (observerDebounceTimer) {
            clearTimeout(observerDebounceTimer);
        }

        observerDebounceTimer = setTimeout(() => {
            requestAnimationFrame(() => {
                if (shouldCheckInputs) injectTitleInputs($('body'));
                if (shouldCheckButton) injectGreetingListButton();
            });
        }, 30); 
    }
});
// =================================================================================
// 7. 메인 채팅창 스와이프 시 제목 표시 로직 (복구됨)
// =================================================================================

$(document).on('click', '.swipe_left, .swipe_right', function() {
    const $mes = $(this).closest('.mes');
    const $idDisplay = $mes.find('.mesIDDisplay');
    
    if ($idDisplay.length === 0 || $idDisplay.text().trim() !== '#0') return;

    const $counter = $mes.find('.swipes-counter');
    if ($counter.length === 0) return;

    const char = characters[this_chid];
    if (!char || !char.data) return;

    const observer = new MutationObserver((mutations) => {
        const counterText = $counter.text().trim();
        if (!counterText) return;

        const parts = counterText.split('/');
        if (parts.length < 2) return;

        const currentSwipeNum = parseInt(parts[0].trim());
        const currentIndex = currentSwipeNum - 1; 
        if (isNaN(currentIndex) || currentIndex < 0) return;

        const charKey = getCurrentCharKey();
        if (!charKey) return;

        const settings = extension_settings[extensionName];
        
        observer.disconnect();

        const hasMainGreeting = char.data.first_mes && char.data.first_mes.trim() !== '';
        const storageIdx = hasMainGreeting ? currentIndex - 1 : currentIndex;

        if (settings && settings.charData && settings.charData[charKey]) {
            const savedTitle = settings.charData[charKey][storageIdx];

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
// 8. 설정창 UI
// =================================================================================

function renderSettingsList() {
    const $container = $('#greeting_titles_list_container');
    if ($container.length === 0) return;

    const searchTerm = $('#gt_search_input').val()?.toLowerCase() || '';

    $container.empty();
    const settings = extension_settings[extensionName];
    
    if (!settings || !settings.charData || Object.keys(settings.charData).length === 0) {
        $container.append('<div style="padding:10px; text-align:center; color:#777;">저장된 데이터가 없습니다.</div>');
        return;
    }

    let hasVisibleItems = false;

    Object.entries(settings.charData).forEach(([charKey, titles]) => {
        const charCard = characters.find(c => c.avatar === charKey || c.name === charKey);
        const displayName = charCard ? charCard.name : `(미설치/삭제됨: ${charKey})`;
        
        const lowerName = displayName.toLowerCase();
        const matchesName = lowerName.includes(searchTerm);
        const matchesTitles = Object.values(titles).some(t => String(t).toLowerCase().includes(searchTerm));

        if (searchTerm && !matchesName && !matchesTitles) return;

        hasVisibleItems = true;
        let titlesHtml = '';
        const sortedIndexes = Object.keys(titles).sort((a, b) => parseInt(a) - parseInt(b));
        
        sortedIndexes.forEach((idx) => {
            const txt = titles[idx];
            const char = characters.find(c => c.avatar === charKey || c.name === charKey);
            const greetingContent = char && char.data && char.data.alternate_greetings 
                ? (char.data.alternate_greetings[parseInt(idx)] || '') 
                : '';
            const hasContent = greetingContent.trim() !== '';
            titlesHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; padding:4px 8px; background:rgba(0,0,0,0.05); border-radius:4px; font-size:0.85rem;">
                    <span>#${parseInt(idx) + 1}: <b>${txt}</b></span>
                    ${hasContent ? `<button class="copy-greeting-btn" data-char-key="${charKey}" data-idx="${parseInt(idx)}" title="그리팅 전체 텍스트 복사"><i class="fa-regular fa-copy"></i> 복사</button>` : ''}
                </div>`;
        });

        const html = `
            <div class="title-list-item" style="border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px;">
                <div class="title-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong style="font-size: 1.1em; color: var(--mainColor);">${displayName}</strong>
                    <div style="display:flex; gap:5px;">
                        <button class="backup-single-btn" data-key="${charKey}" title="이 캐릭터 데이터만 백업(JSON)">
                            <i class="fa-solid fa-download"></i>
                        </button>
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

    if (!hasVisibleItems && searchTerm) {
        $container.append('<div style="padding:20px; text-align:center; color:#777; font-size:0.9rem;">검색 결과가 없습니다.</div>');
    }

    $('.copy-greeting-btn').off('click').on('click', function() {
        const key = $(this).data('char-key');
        const idx = $(this).data('idx');
        const char = characters.find(c => c.avatar === key || c.name === key);
        if (!char || !char.data || !char.data.alternate_greetings) {
            toastr.warning('캐릭터가 설치되어 있지 않아 그리팅 내용을 불러올 수 없습니다.', '', { timeOut: 2000 });
            return;
        }
        const greetingText = char.data.alternate_greetings[idx] || '';
        if (!greetingText) return;
        navigator.clipboard.writeText(greetingText).then(() => {
            toastr.success('그리팅 텍스트가 복사되었습니다!', '', { timeOut: 1500, positionClass: 'toast-top-center' });
        }).catch(() => {
            toastr.error('복사에 실패했습니다.', '', { timeOut: 1500 });
        });
    });

    $('.backup-single-btn').off('click').on('click', function() {
        const key = $(this).data('key');
        const settings = extension_settings[extensionName];
        if (settings.charData[key]) {
            const exportData = {};
            exportData[key] = settings.charData[key];
            const safeName = key.replace(/[^a-zA-Z0-9-_]/g, '_');
            downloadAsJson(exportData, `GreetingTitles_${safeName}`);
        }
    });

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

        if (confirm(`선택한 데이터를 현재 활성화된 캐릭터로 이동하시겠습니까?\n\n주의: 기존 데이터는 삭제되고 현재 캐릭터의 데이터로 덮어씌워집니다.`)) {
            const settings = extension_settings[extensionName];
            if (settings.charData[oldKey]) {
                settings.charData[currentKey] = JSON.parse(JSON.stringify(settings.charData[oldKey]));
                delete settings.charData[oldKey];
                saveSettingsDebounced();
                renderSettingsList();
                $('.greeting-title-input').remove(); 
                $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
                injectTitleInputs($('body'));
                toastr.success(`데이터가 이동되었습니다.`);
            }
        }
    });

    $('.delete-btn').off('click').on('click', function() {
        const key = $(this).data('key');
        if (confirm('이 캐릭터의 모든 메모를 삭제하시겠습니까?')) {
            if (extension_settings[extensionName].charData[key]) {
                delete extension_settings[extensionName].charData[key];
                saveSettingsDebounced();
                renderSettingsList();
                const currentKey = getCurrentCharKey();
                if (key === currentKey) $(`.greeting-title-input`).val('');
            }
        }
    });
}

// =================================================================================
// 9. 초기화
// =================================================================================

(async function() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = DEFAULT_SETTINGS;
    }

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings").append(settingsHtml);
        
        $('#refresh_titles_list_btn').on('click', renderSettingsList);

        $(document).on('input', '#gt_search_input', function() {
            renderSettingsList();
        });

        $('#backup_all_titles_btn').on('click', function() {
            const settings = extension_settings[extensionName];
            if (!settings || !settings.charData) {
                toastr.info('백업할 데이터가 없습니다.');
                return;
            }
            downloadAsJson(settings.charData, `GreetingTitles_All_Backup_${new Date().toISOString().slice(0,10)}`);
        });

        $('#import_titles_btn').on('click', function() {
            $('#import_titles_file').click();
        });

        $('#import_titles_file').on('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);
                    
                    if (typeof importedData !== 'object' || importedData === null) {
                        throw new Error('Invalid JSON format');
                    }

                    const settings = extension_settings[extensionName];
                    if (!settings.charData) settings.charData = {};

                    let importCount = 0;

                    Object.keys(importedData).forEach(charKey => {
                        if (typeof importedData[charKey] === 'object') {
                            if (settings.charData[charKey]) {
                                settings.charData[charKey] = {
                                    ...settings.charData[charKey],
                                    ...importedData[charKey]
                                };
                            } else {
                                settings.charData[charKey] = importedData[charKey];
                            }
                            importCount++;
                        }
                    });

                    saveSettingsDebounced();
                    renderSettingsList();
                    
                    $('.greeting-title-input').remove(); 
                    $('.greeting-title-input-injected').removeClass('greeting-title-input-injected');
                    injectTitleInputs($('body'));

                    toastr.success(`${importCount}개의 캐릭터 데이터를 성공적으로 가져왔습니다.`);
                    
                } catch (err) {
                    console.error('[GreetingTitles] Import Error:', err);
                    toastr.error('파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 파일인지 확인해주세요.');
                }
                
                $('#import_titles_file').val('');
            };
            reader.readAsText(file);
        });

        renderSettingsList();
        $(document).on('click', '.greetingtitles-settings .inline-drawer-header', renderSettingsList);
        $(document).on('click', '.greetingtitles-settings .inline-drawer-toggle', renderSettingsList);

    } catch (e) {
        console.error(`[${extensionName}] Settings HTML load failed:`, e);
    }
    
    injectPopupStyles();
    createCustomPopup();

    injectGreetingListButton();
    
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
})();