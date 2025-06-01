const esbuild = require("esbuild");
const copyPlugin = require("esbuild-plugin-copy");

const watchFlag = process.argv.indexOf("--watch") > -1;
const minifyFlag = process.argv.indexOf("--minify") > -1;

const opts = {
	entryPoints: ["src/script.ts", "src/sw.ts"],
	bundle: true,
	outdir: "dist",
	bundle: true,
	minify: minifyFlag,
	sourcemap: minifyFlag ? false : "both",
	plugins: [
		copyPlugin.copy({
			assets: [
				{ from: ["./src/index.html"], to: ["./"] },
				{ from: ["./src/style.css"], to: ["./"] },
				{ from: ["./src/manifest.json"], to: ["./"] },
				{ from: ["./src/icons/*"], to: ["./icons"] },
				{
					from: ["./node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2"],
					to: ["./"],
				},
			],
		}),
	],
};

if (watchFlag) {
	esbuild.context(opts).then(async (ctx) => {
		const { port } = await ctx.serve({
			servedir: "dist",
		});
		console.log(`Serving on http://127.0.0.1:${port}`);
	});
} else {
	esbuild.build(opts);
}
