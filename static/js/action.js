// 위젯 생성 관련 이벤트 핸들러들

// Add Widget 버튼 클릭 이벤트
function handleAddWidgetClick() {
    console.log('Add Widget button clicked');

    // 현재는 이미지 디스플레이 위젯만 생성
    // 나중에 위젯 선택 모달이나 드롭다운으로 확장 가능
    const widgetId = createImageDisplayWidget();

    if (widgetId) {
        console.log(`Widget created successfully: ${widgetId}`);
        // 성공 메시지 표시 (선택사항)
        showToast('이미지 디스플레이 위젯이 생성되었습니다:' + widgetId, 'success');
    } else {
        console.error('Failed to create widget');
        showToast('위젯 생성에 실패했습니다.', 'error');
    }
}

// Clear All 버튼 클릭 이벤트
function handleClearAllWidgetsClick() {
    console.log('Clear All Widgets button clicked');

    if (window.mainGridStack) {
        // 코드 에디터와 출력 패널을 제외한 모든 위젯 제거
        const widgets = window.mainGridStack.getGridItems();
        widgets.forEach(widget => {
            const widgetId = widget.getAttribute('id');
            if (widgetId !== 'codeEditorWidget' && widgetId !== 'outputPanelWidget') {
                window.mainGridStack.removeWidget(widget);
            }
        });

        // 카운터 초기화
        numImageDisplayWidget = 0;

        showToast('모든 위젯이 제거되었습니다.', 'info');
    }
}






// 위젯 설정 버튼 클릭 이벤트
function handleWidgetSettingsClick() {
    console.log('Widget Settings button clicked');
    // 위젯 설정 모달이나 패널 표시 (향후 구현)
    showToast('위젯 설정 기능은 준비 중입니다.', 'info');
}