<script setup lang="ts">
const route = useRoute()
await navigateTo(`/space/${String(route.params.handle)}?mode=edit`, { replace: true })
</script>

<template>
  <main />
</template>
