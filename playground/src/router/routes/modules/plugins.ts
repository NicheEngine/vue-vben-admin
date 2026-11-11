import type { RouteRecordRaw } from 'vue-router';

import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: 'mingcute:plugin-2-line',
      keepAlive: true,
      order: 1100,
      title: $t('plugins.title'),
    },
    name: 'Plugins',
    path: '/plugins',
    children: [
      {
        name: 'CesiumPluginExample',
        path: 'cesium',
        component: () => import('#/views/plugins/cesium-plugin/index.vue'),
        meta: {
          icon: 'simple-icons:cesium',
          title: $t('plugins.cesium'),
        },
      },
      {
        name: 'TiandituPluginExample',
        path: 'tianditu',
        component: () => import('#/views/plugins/tianditu-plugin/index.vue'),
        meta: {
          icon: 'mdi:map',
          title: $t('plugins.tianditu'),
        },
      },
      {
        name: 'AmapPluginExample',
        path: 'amap',
        redirect: '/plugins/amap/amap-2d',
        meta: {
          icon: 'mdi:map-marker-radius-outline',
          title: $t('plugins.amap.title'),
        },
        children: [
          {
            name: 'Amap2dPluginExample',
            path: 'amap-2d',
            component: () =>
              import('#/views/plugins/amap-plugin/amap-2d-plugin/index.vue'),
            meta: {
              icon: 'mdi:map-marker-radius-outline',
              title: $t('plugins.amap.2d'),
            },
          },
          {
            name: 'Amap3dPluginExample',
            path: 'amap-3d',
            component: () =>
              import('#/views/plugins/amap-plugin/amap-3d-plugin/index.vue'),
            meta: {
              icon: 'mdi:map-marker-radius-outline',
              title: $t('plugins.amap.3d'),
            },
          },
        ],
      },
      {
        name: 'PlayerPluginExample',
        path: 'player',
        redirect: '/plugins/player/auto-player',
        meta: {
          icon: 'mdi:play-box-multiple-outline',
          title: $t('plugins.player.title'),
        },
        children: [
          {
            name: 'AutoPlayerPluginExample',
            path: 'auto-player',
            component: () =>
              import('#/views/plugins/player-plugin/auto-player-plugin/index.vue'),
            meta: {
              icon: 'mdi:auto-fix',
              title: $t('plugins.player.auto'),
            },
          },
          {
            name: 'LivePlayerPluginExample',
            path: 'live-player',
            component: () =>
              import('#/views/plugins/player-plugin/live-player-plugin/index.vue'),
            meta: {
              icon: 'mdi:video-outline',
              title: $t('plugins.player.live'),
            },
          },
          {
            name: 'EasyPlayerPluginExample',
            path: 'easy-player',
            component: () =>
              import('#/views/plugins/player-plugin/easy-player-plugin/index.vue'),
            meta: {
              icon: 'mdi:play-circle-outline',
              title: $t('plugins.player.easy'),
            },
          },
          {
            name: 'JessibucaPluginExample',
            path: 'jessibuca-player',
            component: () =>
              import('#/views/plugins/player-plugin/jessibuca-player-plugin/index.vue'),
            meta: {
              icon: 'mdi:movie-play-outline',
              title: $t('plugins.player.jessibuca'),
            },
          },
          {
            name: 'OssrsPlayerPluginExample',
            path: 'ossrs-player',
            component: () =>
              import('#/views/plugins/player-plugin/ossrs-player-plugin/index.vue'),
            meta: {
              icon: 'mdi:play-network-outline',
              title: $t('plugins.player.ossrs'),
            },
          },
        ],
      },
    ],
  },
];

export default routes;
