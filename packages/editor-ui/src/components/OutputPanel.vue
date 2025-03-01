<template>
	<RunData
		:nodeUi="node"
		:runIndex="runIndex"
		:linkedRuns="linkedRuns"
		:canLinkRuns="canLinkRuns"
		:tooMuchDataTitle="$locale.baseText('ndv.output.tooMuchData.title')"
		:noDataInBranchMessage="$locale.baseText('ndv.output.noOutputDataInBranch')"
		:isExecuting="isNodeRunning"
		:executingMessage="$locale.baseText('ndv.output.executing')"
		:sessionId="sessionId"
		:blockUI="blockUI"
		:isProductionExecutionPreview="isProductionExecutionPreview"
		paneType="output"
		@runChange="onRunIndexChange"
		@linkRun="onLinkRun"
		@unlinkRun="onUnlinkRun"
		@tableMounted="$emit('tableMounted', $event)"
		@itemHover="$emit('itemHover', $event)"
		ref="runData"
		:data-output-type="outputMode"
	>
		<template #header>
			<div :class="$style.titleSection">
				<template v-if="hasAiMetadata">
					<n8n-radio-buttons
						:options="outputTypes"
						v-model="outputMode"
						@update:modelValue="onUpdateOutputMode"
					/>
				</template>
				<span :class="$style.title" v-else>
					{{ $locale.baseText(outputPanelEditMode.enabled ? 'ndv.output.edit' : 'ndv.output') }}
				</span>
				<RunInfo
					v-if="!hasPinData && runsCount === 1"
					v-show="!outputPanelEditMode.enabled"
					:taskData="runTaskData"
				/>

				<n8n-info-tip
					theme="warning"
					type="tooltip"
					tooltipPlacement="right"
					v-if="hasNodeRun && staleData"
				>
					<span
						v-html="
							$locale.baseText(
								hasPinData
									? 'ndv.output.staleDataWarning.pinData'
									: 'ndv.output.staleDataWarning.regular',
							)
						"
					></span>
				</n8n-info-tip>
			</div>
		</template>

		<template #node-not-run>
			<n8n-text v-if="workflowRunning && !isTriggerNode" data-test-id="ndv-output-waiting">{{
				$locale.baseText('ndv.output.waitingToRun')
			}}</n8n-text>
			<n8n-text v-if="!workflowRunning" data-test-id="ndv-output-run-node-hint">
				{{ $locale.baseText('ndv.output.runNodeHint') }}
				<span @click="insertTestData" v-if="canPinData">
					<br />
					{{ $locale.baseText('generic.or') }}
					<n8n-text tag="a" size="medium" color="primary">
						{{ $locale.baseText('ndv.output.insertTestData') }}
					</n8n-text>
				</span>
			</n8n-text>
		</template>

		<template #no-output-data>
			<n8n-text :bold="true" color="text-dark" size="large">{{
				$locale.baseText('ndv.output.noOutputData.title')
			}}</n8n-text>
			<n8n-text>
				{{ $locale.baseText('ndv.output.noOutputData.message') }}
				<a @click="openSettings">{{
					$locale.baseText('ndv.output.noOutputData.message.settings')
				}}</a>
				{{ $locale.baseText('ndv.output.noOutputData.message.settingsOption') }}
			</n8n-text>
		</template>

		<template #content v-if="outputMode === 'logs'">
			<run-data-ai :node="node" :run-index="runIndex" />
		</template>
		<template #recovered-artificial-output-data>
			<div :class="$style.recoveredOutputData">
				<n8n-text tag="div" :bold="true" color="text-dark" size="large">{{
					$locale.baseText('executionDetails.executionFailed.recoveredNodeTitle')
				}}</n8n-text>
				<n8n-text>
					{{ $locale.baseText('executionDetails.executionFailed.recoveredNodeMessage') }}
				</n8n-text>
			</div>
		</template>

		<template #run-info v-if="!hasPinData && runsCount > 1">
			<RunInfo :taskData="runTaskData" />
		</template>
	</RunData>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { IExecutionResponse, INodeUi } from '@/Interface';
import type { INodeTypeDescription, IRunData, IRunExecutionData, ITaskData } from 'n8n-workflow';
import RunData from './RunData.vue';
import RunInfo from './RunInfo.vue';
import { pinData } from '@/mixins/pinData';
import { mapStores } from 'pinia';
import { useUIStore } from '@/stores/ui.store';
import { useWorkflowsStore } from '@/stores/workflows.store';
import { useNDVStore } from '@/stores/ndv.store';
import { useNodeTypesStore } from '@/stores/nodeTypes.store';
import RunDataAi from './RunDataAi/RunDataAi.vue';
import { ndvEventBus } from '@/event-bus';

type RunDataRef = InstanceType<typeof RunData>;

const OUTPUT_TYPE = {
	REGULAR: 'regular',
	LOGS: 'logs',
};

export default defineComponent({
	name: 'OutputPanel',
	mixins: [pinData],
	components: { RunData, RunInfo, RunDataAi },
	data() {
		return {
			outputMode: 'regular',
			outputTypes: [
				{ label: this.$locale.baseText('ndv.output.outType.regular'), value: OUTPUT_TYPE.REGULAR },
				{ label: this.$locale.baseText('ndv.output.outType.logs'), value: OUTPUT_TYPE.LOGS },
			],
		};
	},
	props: {
		runIndex: {
			type: Number,
		},
		isReadOnly: {
			type: Boolean,
		},
		linkedRuns: {
			type: Boolean,
		},
		canLinkRuns: {
			type: Boolean,
		},
		sessionId: {
			type: String,
		},
		blockUI: {
			type: Boolean,
			default: false,
		},
		isProductionExecutionPreview: {
			type: Boolean,
			default: false,
		},
	},
	computed: {
		...mapStores(useNodeTypesStore, useNDVStore, useUIStore, useWorkflowsStore),
		node(): INodeUi | null {
			return this.ndvStore.activeNode;
		},
		nodeType(): INodeTypeDescription | null {
			if (this.node) {
				return this.nodeTypesStore.getNodeType(this.node.type, this.node.typeVersion);
			}
			return null;
		},
		isTriggerNode(): boolean {
			return this.nodeTypesStore.isTriggerNode(this.node.type);
		},
		hasAiMetadata(): boolean {
			if (this.node) {
				const resultData = this.workflowsStore.getWorkflowResultDataByNodeName(this.node.name);

				if (!resultData || !Array.isArray(resultData) || resultData.length === 0) {
					return false;
				}

				return !!resultData[resultData.length - 1].metadata;
			}
			return false;
		},
		isPollingTypeNode(): boolean {
			return !!(this.nodeType && this.nodeType.polling);
		},
		isScheduleTrigger(): boolean {
			return !!(this.nodeType && this.nodeType.group.includes('schedule'));
		},
		isNodeRunning(): boolean {
			return this.node && this.workflowsStore.isNodeExecuting(this.node.name);
		},
		workflowRunning(): boolean {
			return this.uiStore.isActionActive('workflowRunning');
		},
		workflowExecution(): IExecutionResponse | null {
			return this.workflowsStore.getWorkflowExecution;
		},
		workflowRunData(): IRunData | null {
			if (this.workflowExecution === null) {
				return null;
			}
			const executionData: IRunExecutionData | undefined = this.workflowExecution.data;
			if (!executionData?.resultData?.runData) {
				return null;
			}
			return executionData.resultData.runData;
		},
		hasNodeRun(): boolean {
			if (this.workflowsStore.subWorkflowExecutionError) return true;

			return Boolean(
				this.node && this.workflowRunData && this.workflowRunData.hasOwnProperty(this.node.name),
			);
		},
		runTaskData(): ITaskData | null {
			if (!this.node || this.workflowExecution === null) {
				return null;
			}

			const runData = this.workflowRunData;

			if (runData === null || !runData.hasOwnProperty(this.node.name)) {
				return null;
			}

			if (runData[this.node.name].length <= this.runIndex) {
				return null;
			}

			return runData[this.node.name][this.runIndex];
		},
		runsCount(): number {
			if (this.node === null) {
				return 0;
			}

			const runData: IRunData | null = this.workflowRunData;

			if (runData === null || !runData.hasOwnProperty(this.node.name)) {
				return 0;
			}

			if (runData[this.node.name].length) {
				return runData[this.node.name].length;
			}

			return 0;
		},
		staleData(): boolean {
			if (!this.node) {
				return false;
			}
			const updatedAt = this.workflowsStore.getParametersLastUpdate(this.node.name);
			if (!updatedAt || !this.runTaskData) {
				return false;
			}
			const runAt = this.runTaskData.startTime;
			return updatedAt > runAt;
		},
		outputPanelEditMode(): { enabled: boolean; value: string } {
			return this.ndvStore.outputPanelEditMode;
		},
		canPinData(): boolean {
			return this.isPinDataNodeType && !this.isReadOnly;
		},
	},
	methods: {
		insertTestData() {
			const runDataRef = this.$refs.runData as RunDataRef | undefined;
			if (runDataRef) {
				runDataRef.enterEditMode({
					origin: 'insertTestDataLink',
				});

				this.$telemetry.track('User clicked ndv link', {
					workflow_id: this.workflowsStore.workflowId,
					session_id: this.sessionId,
					node_type: this.node.type,
					pane: 'output',
					type: 'insert-test-data',
				});
			}
		},
		onLinkRun() {
			this.$emit('linkRun');
		},
		onUnlinkRun() {
			this.$emit('unlinkRun');
		},
		openSettings() {
			this.$emit('openSettings');
			this.$telemetry.track('User clicked ndv link', {
				node_type: this.node.type,
				workflow_id: this.workflowsStore.workflowId,
				session_id: this.sessionId,
				pane: 'output',
				type: 'settings',
			});
		},
		onRunIndexChange(run: number) {
			this.$emit('runChange', run);
		},
		onUpdateOutputMode(outputMode: (typeof OUTPUT_TYPE)[string]) {
			if (outputMode === OUTPUT_TYPE.LOGS) {
				ndvEventBus.emit('setPositionByName', 'minLeft');
			} else {
				ndvEventBus.emit('setPositionByName', 'initial');
			}
		},
	},
});
</script>

<style lang="scss" module>
// The items count and displayModes are rendered in the RunData component
// this is a workaround to hide it in the output panel(for ai type) to not add unnecessary one-time props
:global([data-output-type='logs'] [class*='itemsCount']),
:global([data-output-type='logs'] [class*='displayModes']) {
	display: none;
}
.outputTypeSelect {
	margin-bottom: var(--spacing-4xs);
	width: fit-content;
}
.titleSection {
	display: flex;

	> * {
		margin-right: var(--spacing-2xs);
	}
}

.title {
	text-transform: uppercase;
	color: var(--color-text-light);
	letter-spacing: 3px;
	font-weight: var(--font-weight-bold);
	font-size: var(--font-size-s);
}

.noOutputData {
	max-width: 180px;

	> *:first-child {
		margin-bottom: var(--spacing-m);
	}

	> * {
		margin-bottom: var(--spacing-2xs);
	}
}

.recoveredOutputData {
	margin: auto;
	max-width: 250px;
	text-align: center;

	> *:first-child {
		margin-bottom: var(--spacing-m);
	}
}
</style>
