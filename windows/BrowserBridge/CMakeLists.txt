cmake_minimum_required(VERSION 3.14)
project(browser_bridge LANGUAGES CXX)

# agilegeek-browser-host.exe, the browsers' native messaging host (host.cpp).
# It goes beside agilegeek.exe with dev.agilegeek.browser.json, the manifest
# the browsers find it by: the installer's keys point there (see
# tool/agilegeek.iss), and its "path", relative, is the host beside it.
add_executable(agilegeek-browser-host "host.cpp")
apply_standard_settings(agilegeek-browser-host)
target_compile_options(agilegeek-browser-host PRIVATE /utf-8)
target_compile_definitions(agilegeek-browser-host PRIVATE
  "NOMINMAX" "WIN32_LEAN_AND_MEAN")
target_link_libraries(agilegeek-browser-host PRIVATE "ws2_32.lib")
