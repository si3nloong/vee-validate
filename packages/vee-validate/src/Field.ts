import { h, defineComponent, nextTick, toRef, SetupContext, resolveDynamicComponent } from 'vue';
import { getConfig } from './config';
import { useField } from './useField';
import { normalizeChildren, hasCheckedAttr, isFileInput } from './utils';

export const Field = defineComponent({
  name: 'Field',
  inheritAttrs: false,
  props: {
    as: {
      type: [String, Object],
      default: undefined,
    },
    name: {
      type: String,
      required: true,
    },
    rules: {
      type: [Object, String, Function],
      default: null,
    },
    validateOnMount: {
      type: Boolean,
      default: false,
    },
    bails: {
      type: Boolean,
      default: () => getConfig().bails,
    },
    label: {
      type: String,
      default: undefined,
    },
  },
  setup(props, ctx) {
    const rules = toRef(props, 'rules');
    const name = toRef(props, 'name');
    const label = toRef(props, 'label');

    const {
      errors,
      value,
      errorMessage,
      validate: validateField,
      handleChange,
      handleBlur,
      handleInput,
      setDirty,
      setTouched,
      resetField,
      handleReset,
      meta,
      checked,
    } = useField(name, rules, {
      validateOnMount: props.validateOnMount,
      bails: props.bails,
      type: ctx.attrs.type as string,
      // Gets the initial value either from `value` prop/attr or `v-model` binding (modelValue)
      // For checkboxes and radio buttons it will always be the model value not the `value` attribute
      initialValue: hasCheckedAttr(ctx.attrs.type)
        ? ctx.attrs.modelValue
        : 'modelValue' in ctx.attrs
        ? ctx.attrs.modelValue
        : ctx.attrs.value,
      // Only for checkboxes and radio buttons
      valueProp: ctx.attrs.value,
      label,
      validateOnValueUpdate: false,
    });

    let isDuringValueTick = false;
    // Prevents re-render updates that rests value when using v-model (#2941)
    function valueTick() {
      isDuringValueTick = true;
      nextTick(() => {
        isDuringValueTick = false;
      });
    }

    // If there is a v-model applied on the component we need to emit the `update:modelValue` whenever the value binding changes
    const onChangeHandler =
      'modelValue' in ctx.attrs
        ? function handleChangeWithModel(e: any) {
            handleChange(e);
            ctx.emit('update:modelValue', value.value);
          }
        : handleChange;

    const onInputHandler =
      'modelValue' in ctx.attrs
        ? function handleChangeWithModel(e: any) {
            handleInput(e);
            ctx.emit('update:modelValue', value.value);
          }
        : handleInput;

    const { validateOnInput, validateOnChange, validateOnBlur, validateOnModelUpdate } = getConfig();
    const baseOnBlur = [handleBlur, ctx.attrs.onBlur, validateOnBlur ? validateField : undefined].filter(Boolean);
    const baseOnInput = [
      onInputHandler,
      valueTick,
      validateOnInput ? onChangeHandler : undefined,
      ctx.attrs.onInput,
    ].filter(Boolean);
    const baseOnChange = [
      onInputHandler,
      valueTick,
      validateOnChange ? onChangeHandler : undefined,
      ctx.attrs.onChange,
    ].filter(Boolean);

    const makeSlotProps = () => {
      const fieldProps: Record<string, any> = {
        name: props.name,
        onBlur: baseOnBlur,
        onInput: baseOnInput,
        onChange: baseOnChange,
      };

      if (validateOnModelUpdate) {
        fieldProps['onUpdate:modelValue'] = [onChangeHandler, valueTick];
      }

      if (hasCheckedAttr(ctx.attrs.type) && checked) {
        fieldProps.checked = checked.value;
      } else {
        fieldProps.value = value.value;
      }

      if (isFileInput(resolveTag(props, ctx), ctx.attrs.type as string)) {
        delete fieldProps.value;
      }

      return {
        field: fieldProps,
        meta,
        errors: errors.value,
        errorMessage: errorMessage.value,
        validate: validateField,
        resetField,
        handleChange: onChangeHandler,
        handleInput: onInputHandler,
        handleReset,
        handleBlur,
        setDirty,
        setTouched,
      };
    };

    return () => {
      const tag = resolveDynamicComponent(resolveTag(props, ctx)) as string;
      const slotProps = makeSlotProps();

      // Sync the model value with the inner field value if they mismatch
      // a simple string comparison is used here
      // make sure to check if the re-render isn't caused by a value update tick
      if ('modelValue' in ctx.attrs && String(ctx.attrs.modelValue) !== String(value.value) && !isDuringValueTick) {
        nextTick(() => {
          handleChange(ctx.attrs.modelValue as any);
        });
      }

      const children = normalizeChildren(ctx, slotProps);
      if (tag) {
        return h(
          tag,
          {
            ...ctx.attrs,
            ...slotProps.field,
          },
          children
        );
      }

      return children;
    };
  },
});

function resolveTag(props: Record<string, any>, ctx: SetupContext) {
  let tag: string = props.as || '';

  if (!props.as && !ctx.slots.default) {
    tag = 'input';
  }

  return tag;
}
