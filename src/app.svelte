<script>
	let { name } = $props();

	$effect(async () => {
		const res = await fetch(`/api/name`).then((r) => r.json());
		name = res.name;
	});
</script>

<h1>Hello {name}</h1>

<style>
	h1 {
		color: #b00b69;
	}
</style>
