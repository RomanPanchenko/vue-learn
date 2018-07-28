<template>
    <div class="hello">
        <h1>innerMessage: {{ innerMessage }}</h1>
        <h1>hiMessage: {{ hiMessage }}</h1>
        <h1>byeMessage: {{ byeMessage }}</h1>
        <h1>neutralMessage: {{ neutral }}</h1>
    </div>
</template>

<script>
    import { mapState } from 'vuex'

    export default {
        name: 'HiWorld',
        props: {
            msg: String
        },
        data() {
            return {
                // If your variable should not be shared between several components
                // you can put it here.
                innerMessage: 'The message belongs to this component',
            }
        },
        computed: {
            // It is a good practice to get access to state variables
            // using `mapState` method.
            // But first of all, you have to import it. We did it in the beginning of the script.
            ...mapState('helloModule', ['hiMessage', 'byeMessage']),
            neutral() {
                // You can use such long sausage to get any state variable,
                // but it is not recommended :)
                return this.$store.state.helloModule.neutralMessage;
            },
        },
    }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
