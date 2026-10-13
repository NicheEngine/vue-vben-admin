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
        name: 'LivePlayerPluginExample',
        path: 'live-player',
        component: () => import('#/views/plugins/live-player-plugin/index.vue'),
        meta: {
          icon: 'mdi:video-outline',
          title: $t('plugins.livePlayer'),
        },
      },
      {
        name: 'EasyPlayerPluginExample',
        path: 'easy-player',
        component: () => import('#/views/plugins/easy-player-plugin/index.vue'),
        meta: {
          icon: 'mdi:play-circle-outline',
          title: $t('plugins.easyPlayer'),
        },
      },
      {
        name: 'JessibucaPluginExample',
        path: 'jessibuca-player',
        component: () =>
          import('#/views/plugins/jessibuca-player-plugin/index.vue'),
        meta: {
          icon: 'mdi:movie-play-outline',
          title: $t('plugins.jessibucaPlayer'),
        },
      },
      {
        name: 'OssrsPlayerPluginExample',
        path: 'ossrs-player',
        component: () =>
          import('#/views/plugins/ossrs-player-plugin/index.vue'),
        meta: {
          icon: 'mdi:play-network-outline',
          title: $t('plugins.ossrsPlayer'),
        },
      },
    ],
  },
];

export default routes;
