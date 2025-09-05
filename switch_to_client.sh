#!/bin/bash
# 스크립트 실행 중 오류가 발생하면 즉시 중단합니다.
set -e

echo "네트워크 모드를 AP에서 클라이언트로 전환합니다..."

# --- 1단계: AP 관련 서비스 중지 및 비활성화 ---
echo "AP 관련 서비스(hostapd, dnsmasq)를 중지하고 비활성화합니다."
systemctl stop hostapd || true
systemctl stop dnsmasq || true
systemctl disable hostapd || true
systemctl disable dnsmasq || true

# --- 2단계: 네트워크 설정을 클라이언트 모드로 변경 ---
echo "네트워크 설정을 DHCP 클라이언트 모드로 복원합니다."
# AP 모드용 고정 IP 설정을 제거하고, 표준 클라이언트 설정으로 덮어씁니다.
tee "/etc/dhcpcd.conf" > /dev/null << EOC
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
EOC

# --- 3단계: 서비스 전환 ---
echo "부팅 시 실행될 서비스를 전환합니다 (wifi_setup -> webeditor)."
# 현재 실행 중인 Wi-Fi 설정 앱 서비스를 비활성화합니다.
systemctl disable wifi_setup.service
# 다음 부팅 시 메인 웹 에디터 서비스가 실행되도록 활성화합니다.
systemctl enable webeditor.service

# --- 4단계: 재부팅으로 모든 변경사항 적용 ---
echo "🎉 설정 완료! 클라이언트 모드로 전환하기 위해 시스템을 재부팅합니다."
reboot